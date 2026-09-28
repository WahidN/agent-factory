## 1. Dead ends in the car logic

- [x] 1.1 Let `pickNext` in `web/traffic-logic.ts` return `null` at a crossing with no onward road, and widen `Vehicle.next` to `string | null`
- [x] 1.2 Handle a null `next` in `laneLength`, `advance`, `vehiclePose` and `gapAhead`, and export `isFinished(roads, vehicle)`
- [x] 1.3 Remove the `reversal` branch and the cubic curve from `turnCurve`, and drop the four-point path from `curvePoint` and `curveTangent`
- [x] 1.4 Make `spawnVehicle` prefer lot lanes that have an onward move
- [x] 1.5 Update `web/tests/traffic-logic.test.ts` for the dead end, and add a case that a vehicle never reverses

## 2. Cars fade out and come back

- [x] 2.1 Add a `retiring` flag to `Traveler` in `web/traffic.ts`, set from `isFinished`
- [x] 2.2 Let a retiring traveler always lose presence, even while its key is wanted
- [x] 2.3 Check that the replacement spawns only once the old traveler is gone, so a lot never has two cars in one slot
- [x] 2.4 Add a test that a car on a dead-end lane fades to zero and the lot's car count returns to what it was

## 3. Cyclists and buses fade out and come back

- [x] 3.1 Add `presence`, `state` and `generation` arrays to `Fleet` in `web/urban-mobility-logic.ts`
- [x] 3.2 Store `-1` in `nextLane` for a dead end instead of the lane back
- [x] 3.3 Move a member to leaving when `advanceFleet` hits `-1`, and reseed it with a bumped generation once presence reaches 0
- [x] 3.4 Fold the generation into `seedOne`, so a reseeded member lands on another lane
- [x] 3.5 Expose the presence per cyclist and per bus, and scale the instances by it in `web/urban-mobility.ts`
- [x] 3.6 Add tests in `web/tests/urban-mobility.test.ts`: a cyclist at a dead end fades out, the count stays stable, and two reseeds do not land on the same lane and distance

## 4. Train service

- [x] 4.1 Replace the bounce in `tick` with a phase (`waiting` or `running`), a timer and a run counter
- [x] 4.2 Pick the entry end and the 35 to 60 s gap from `mix(seed + runCount)`, so both ends get used
- [x] 4.3 Ramp the train presence over the first and last 14 m of the run, clamped to a third of the track on a short track
- [x] 4.4 Report `counts().trains` as 0 while waiting, and scale the train instance by its presence
- [x] 4.5 Add tests: the train keeps one direction, the track is empty for at least 35 s between runs, and both entry ends occur over several runs

## 5. Level crossing positions

- [x] 5.1 Pull the row walk out of `bedBetweenCrossings` in `web/rail-corridor.ts` into an exported `levelCrossingsForCells(cells)` that returns the road z values
- [x] 5.2 Rewrite `bedBetweenCrossings` on top of it, so the gaps in the ballast and the crossings stay in step
- [x] 5.3 Extend `web/tests/rail-corridor.test.ts`: no crossing on the water edge row, one crossing per road row, and a gap in the bed at every crossing

## 6. Barrier state

- [x] 6.1 Keep one boom progress per crossing in `UrbanMobilitySimulation`, rebuilt in `setRoads` from `levelCrossingsForCells`
- [x] 6.2 Close a crossing while the train is within 60 m ahead of it, and hold it closed until the tail is 25 m past
- [x] 6.3 Move the boom progress toward its target at 1 per second in `tick`
- [x] 6.4 Expose the boom progress per crossing, and the z values of the crossings that road traffic must not enter
- [x] 6.5 Add tests for the timing: open with no train, closing before the train arrives, still closed while it passes, open again after it clears

## 7. Road traffic stops for the barrier

- [x] 7.1 Add a pure `railCrossingLanes(roads)` to `web/traffic-logic.ts`, mapping the lane keys running into the rail column to their crossing z
- [x] 7.2 Let `stepVehicles` take the blocked lane keys and brake on the distance to the stop line, 7 before the crossing centre, through the existing gap ramp
- [x] 7.3 Leave a vehicle past the stop line alone, so nothing halts on the track
- [x] 7.4 Build the blocked set in `web/traffic.ts` from `railCrossingLanes` and the closed crossings, and pass it into `stepVehicles`
- [x] 7.5 Clamp the distance in `advanceFleet` on a blocked lane, with a small per-member stop offset from `variant`
- [x] 7.6 Add tests: a car stops clear of the track, a car on the crossing drives on, three cars queue, and waiting cyclists stand apart

## 8. Barrier meshes

- [x] 8.1 Add `web/level-crossing.ts` with a `LevelCrossings` class: instanced posts, booms and Andreaskruis, two sides per crossing, at most 12 crossings
- [x] 8.2 Translate the boom geometry so its pivot sits at the origin, and rotate it per instance from upright to horizontal
- [x] 8.3 Paint the boom in red and white bands and give the post a base, so the crossing reads without a train
- [x] 8.4 Drive the instances from the boom progress each frame, and rebuild them when the roads change
- [x] 8.5 Add a test that the mesh count follows the number of crossings and the boom angle follows the progress

## 9. Wiring and checks

- [x] 9.1 Add the barrier group to the scene in `web/main.ts` and tick it with the mobility
- [x] 9.2 Move `mobility.tick` in front of `traffic.tick`, so the barrier state the cars read is from this frame
- [x] 9.3 Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, and report the output
- [x] 9.4 Check it in the browser with agent-browser: a train run with the booms going down and up, and cars standing still at the line
