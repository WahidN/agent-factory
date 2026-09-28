## Why

Road traffic that reaches the edge of the built park turns around on the spot. `pickNext` in
`web/traffic-logic.ts` falls back to the lane going back, and `UrbanMobilitySimulation.setRoads`
does the same for cyclists and buses. A car spinning around in the middle of an empty road reads as
a bug, and the factory-scene spec already says vehicles never make a U-turn.

The train has the same problem, louder. It runs non-stop between two ends of the track and reverses
at each one, so the same NS train drives backwards through the city every few seconds. Nothing marks
the level crossings either, so cars and trains drive through each other on the tracks.

## What Changes

- Cars and trucks that run out of road fade out where the road ends instead of turning around. The
  lot that sent the vehicle sends a fresh one, which appears on a road near itself, so the vehicle
  count per lot stays the same.
- Cyclists and buses do the same: fade out at a dead end, then fade back in on another lane.
- The train becomes a service instead of a shuttle. One train enters at a random end, drives the
  whole track in one direction, fades out past the far end, and the rails then stay empty for 35 to
  60 seconds before the next train.
- Every place where an east-west road crosses the track gets a level crossing: two barriers, a post
  on each side of the road, and a red and white boom that lowers when a train approaches and rises
  once it has passed.
- Cars, trucks, cyclists and buses stop before the track while a barrier is down and drive on when
  it opens. A vehicle already on the crossing keeps going and clears it.

## Capabilities

### New Capabilities
- `city-mobility`: the city traffic that does not belong to a session, so cyclists, buses, the train
  service on the Spoorbrug line, and the level crossings where road and rail meet.

### Modified Capabilities
- `factory-scene`: "Traffic follows activity" gets the dead-end rule (fade out and respawn instead
  of a U-turn) and the rule that a session's vehicles wait for a closed barrier.

## Impact

- `web/traffic-logic.ts`: `pickNext` reports a dead end instead of the lane back, `advance` and
  `laneLength` handle a vehicle without an onward lane, `stepVehicles` takes the blocked lanes.
- `web/traffic.ts`: a traveler that reaches a dead end fades out, and its slot is refilled after it
  is gone.
- `web/urban-mobility-logic.ts`: per-member presence for cyclists and buses, the train service loop
  with its waiting gap, and the barrier state the rest of the scene reads.
- `web/urban-mobility.ts`: instances scale with presence, plus the new barrier meshes.
- `web/rail-corridor.ts`: exports where the level crossings sit, from the same rows that already
  interrupt the ballast.
- `web/main.ts`: ticks the city mobility before the park traffic, so the barrier state the cars read
  is from this frame.
- New tests in `web/tests/` for the dead-end fade, the train service loop and the barrier timing.
