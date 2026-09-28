## Context

See proposal.md for the motivation. Three separate simulations drive what moves in the scene, and
this change touches all three.

- `web/traffic-logic.ts` drives the session cars and trucks. Vehicles are plain objects on a lane
  graph, with `pickNext` choosing the next lane and `stepVehicles` braking on the gap ahead.
- `web/urban-mobility-logic.ts` drives the cyclists, the buses and the train. It is allocation-free:
  fleets are typed arrays and the next lane per member is baked into `nextLane` when the roads
  change. The train is one number, `trainZ`, bouncing between two bounds.
- `web/rail-corridor.ts` builds the track. It already knows which rows have a road crossing it,
  because it cuts the ballast and fencing there.

Two constraints shape the rest. The roads come and go: `setRoads` runs whenever the park grows or
shrinks, so nothing may assume a lane survives. And the whole scene draws through instanced meshes
with a fixed maximum, so a barrier cannot be a per-crossing `THREE.Group`.

`PLOT_SIZE` is 60 and the rail runs on the crossing line at column `RAIL_BRIDGE.col`, which is why
`roadGraph` already drops the north-south roads there. Every lane that ends at a crossing on that
column therefore arrives from the east or the west and continues straight over the track.

## Goals / Non-Goals

**Goals:**
- One shared idea of "this vehicle is done" that the car sim and the cyclist sim both express, each
  in its own style.
- The barrier state lives in one place and both road simulations read it.
- The level crossing positions come from the same rows that already cut the ballast, so the barriers
  cannot drift away from the gaps in the track.

**Non-Goals:**
- No change to what happens when a road disappears under a vehicle because the park shrank. Those
  vehicles still vanish at once. Fading them needs a frozen pose for a lane that is no longer in the
  graph, which is a bigger change than this one.
- No train station, no stopping train, no passengers.
- No sound, no flashing lights on the crossing. The boom and the cross carry it.

## Decisions

### A dead end is `next: null`, not the lane back

`pickNext` returns `null` when the crossing at the end of the lane has no onward road, instead of
falling back to `back`. `Vehicle.next` becomes `string | null`, `laneLength` is just `STRAIGHT` for
such a vehicle, and `advance` leaves it parked at `s === STRAIGHT`. A new exported `isFinished`
answers whether a vehicle has run out of road.

Alternative considered: keep the U-turn in the logic and let `traffic.ts` notice the reversal
afterwards. Rejected because the reversal is also a legal move nowhere else in the graph, so the
caller would be guessing. Making the dead end explicit also lets the cubic U-turn curve and its
`reversal` branch go, which removes the only four-point curve in the file.

The rest of the file follows: `gapAhead` skips the `other.lane === v.next` branch when `next` is
null, `turnCurve` is never called for such a vehicle.

### A finished car fades out and its lot fills the slot again

`ParkTraffic` gets a `retiring` flag per traveler. `updateTravelers` sets it when `isFinished` says
so, and a retiring traveler always loses presence even though its key is still wanted. `want` keeps
skipping the key while the old traveler is still there, so the replacement appears only after the
fade finishes, about 0.5 s later. It spawns through the existing `spawnVehicle`, which puts it on a
road around its own lot, so the count per lot never changes.

`spawnVehicle` also starts preferring lanes that have an onward move. Without that, a lot on the
river bank would spawn a car that drives one road length and fades again, over and over.

### Cyclists and buses get a presence and a generation, still in typed arrays

`Fleet` gains `presence: Float32Array`, `state: Uint8Array` (entering, riding, leaving) and
`generation: Uint32Array`. `nextLane` stores `-1` for a dead end instead of the lane back. When
`advanceFleet` would step onto `-1`, the member goes to leaving; at presence 0 it bumps its
generation and reseeds.

The generation is what makes the replacement appear elsewhere. `seedOne` hashes
`seed + i * 977 + generation * 7919`, so the same member lands on a different lane every time
instead of looping over the same two roads.

Alternative considered: `Math.random` for the respawn. Rejected because the whole fleet is seeded,
which keeps the city reproducible between reloads and keeps the tests deterministic.

### The train becomes a service with a waiting gap

`trainDirection` stays, `trainZ` stays, the bounce goes. The service is a small state machine on two
fields: a phase (`waiting` or `running`) and a timer.

- On entry: pick the direction from `mix(seed + runCount)`, put the train at the end it enters from.
- Running: drive at 12 m/s toward the far end. Presence ramps from 0 to 1 over the first 14 m and
  back to 0 over the last 14 m, so the train fades in as it comes on and out as it leaves.
- At the far end: phase becomes waiting, with a timer of 35 to 60 s from the same hash.

Fourteen metres is a bit over a second at 12 m/s, which reads as a fade and not as a pop. On a very
short track the fade span clamps to a third of the track length, so the train still fades on both
ends instead of never reaching full opacity.

`counts().trains` becomes 0 while waiting, so the instanced mesh draws nothing rather than a
zero-scaled matrix.

### The barrier state lives with the train

`UrbanMobilitySimulation` owns the crossings, because it owns the train and nothing else knows where
the train is. `setRoads` asks `rail-corridor.ts` for the crossing positions and keeps one boom
progress per crossing, 0 for up and 1 for down.

A crossing closes when the train is active and the crossing lies within 60 m ahead of the train
along its direction of travel, and it stays closed until the tail of the train is 25 m past it. At
12 m/s that is five seconds of warning. The boom moves toward its target at 1 per second, so the arm
takes about a second to swing.

The simulation exposes the boom progress per crossing for drawing, and the set of crossing z values
that road traffic must not enter. Road traffic treats a crossing as shut as soon as the boom starts
to move, which is what a real AHOB does.

### The crossing positions come out of `rail-corridor.ts`

`bedBetweenCrossings` already walks the rows and cuts the bed where a road passes. That loop moves
into an exported `levelCrossingsForCells`, which returns the road z values, and
`bedBetweenCrossings` uses it. One function decides where a crossing is, so the barrier can never
stand next to a gap instead of in it.

### Both road sims stop at the same line, each in its own way

The stop line sits `7` before the centre of the rail crossing: the ballast is 8.6 wide, so 4.3 plus
a margin.

- Cars: `stepVehicles` takes the blocked lane keys. For a blocked lane the distance left to the stop
  line feeds through the same `MIN_GAP`/`FREE_GAP` ramp as the gap ahead, and the smaller of the two
  wins. Braking therefore looks like braking for another car, and `gapAhead` already makes the
  followers queue. A vehicle past the stop line is not slowed, so nothing stops on the track.
- Cyclists and buses: `advanceFleet` clamps the distance on a blocked lane. Each member gets a small
  stop offset from its `variant`, so four waiting bikes stand a few metres apart instead of on one
  point. Again only members that have not passed the line are clamped.

`traffic-logic.ts` gets a pure `railCrossingLanes(roads)` that maps the lane keys running into the
rail column to the z of their crossing. `traffic.ts` builds the blocked set from that map and the
closed z values it reads from the mobility simulation each frame.

### `main.ts` ticks the city before the park traffic

`mobility.tick` moves in front of `traffic.tick`, so the barrier state the cars read is from this
frame and not the last one. Without it a car gets one frame of stale barrier, which at 12 m/s is
20 cm. Small, but the ordering costs nothing.

### The barriers are three instanced meshes

New `web/level-crossing.ts` with a `LevelCrossings` class: posts, booms and the Andreaskruis, one
instanced mesh each, two sides per crossing. The boom geometry is translated so its pivot sits at
the origin, so the per-instance matrix can rotate it from upright to horizontal. A fixed maximum of
12 crossings covers a park far bigger than any that has been drawn.

## Risks / Trade-offs

- A lot right on the river bank sends cars into a short dead-end road → `spawnVehicle` prefers lanes
  with an onward move, so it only happens when the lot has no other road.
- Fewer trains means most viewers see an empty track → the barriers, the cross and the boom keep the
  crossing readable even with no train in sight, and the 35 s floor keeps trains frequent enough to
  catch.
- The boom progress is per crossing, so a long park with many crossings costs one more loop per
  frame → it is a handful of numbers, well under the cost of one lane lookup.
- The train fade is a scale, not opacity, so a train fading out shrinks a little as it leaves →
  matches how every other vehicle in the scene appears and disappears, so it reads as the same
  language rather than a new one.
- Removing the U-turn curve drops the only cubic path in `traffic-logic.ts`. If a later change wants
  a real turning circle, it has to come back → the code is in git and the dead-end case is now a
  named state, so putting it back is a smaller job than it was to write.
