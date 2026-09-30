## 1. The ladder splits over lot and HQ

- [x] 1.1 Add `hqFloors(tokens)` to `web/milestone-ladder.ts`, `milestoneIndex(tokens) + 1`, and point the labels in `MILESTONE_LABELS` at where a row stands (flagpole, helipad, turbine and blimp say HQ)
- [x] 1.2 Turn `ROWS` in `web/milestones.ts` into ten `{ at: "lot" | "hq", build }` entries, with the flagpole, helipad, turbine and blimp marked `hq`, and split `buildMilestones` into `buildLotMilestones` and `buildHqMilestones` that walk the same array
- [x] 1.3 Center the helipad on the box it is given, and give the blimp its altitude from `hall.top` instead of the absolute `BLIMP_Y`, so both sit on a tower of any height
- [x] 1.4 Drop the flagpole, helipad, turbine and blimp from `web/lot.ts`: it calls `buildLotMilestones`, and its `extras` list is then always empty, so remove the tick over it if nothing is left to tick
- [x] 1.5 Extend `web/tests/milestone-ladder.test.ts` with `hqFloors` for 0, 10M, 99M, 101M, 600M and 5B, and add a test that the ten rows split into 6 lot rows and 4 HQ rows and stay aligned with `MILESTONES`

## 2. A plot for every user

- [x] 2.1 Change `assignPlots` in `web/plots.ts` to return `{ sessions, hqs }`, with one HQ rank per user that has a session, handed out as the first rank of that user's run
- [x] 2.2 Give `PlotAllocator` an `hqIndexOf(user)` and let `indexes()` return the session ranks and the HQ ranks together
- [x] 2.3 Update `web/tests/plots.test.ts` for the new return shape, and add tests for one HQ rank per user, the HQ first in its user's run, no HQ for a user without sessions, and the whole set still packed into 0..n-1

## 3. The HQ itself

- [x] 3.1 New `web/hq.ts`: a class with `group`, `update(tokens)`, `tick(dt)`, `relocate(x, z)`, `remove(onGone)`, `dispose()` and `consumeShadowDirty()`, mirroring what `Lot` exposes
- [x] 3.2 Build the plot: a plaza over the block, the tower at the back with a footprint of 20 by 18, an entrance canopy facing +z, and a forecourt in front of it
- [x] 3.3 Build the tower from `hqFloors(tokens)` floors of `WALL_BAY.height`, in the user's wall tint with the same window grid a hall uses, and rebuild it in place when the floor count changes
- [x] 3.4 Call `buildHqMilestones` with the tower's box as the context, so the flagpole, helipad, turbine and blimp land on the HQ, and tick the turbine and the blimp
- [x] 3.5 Give the HQ the rise and sink of a lot, and follow the lifecycle rules in `.claude/rules/web-scene-lifecycle.md`: every invariant set where the HQ is built, and no shared geometry freed in `dispose()`
- [x] 3.6 Put the user's name on the roof with `web/roof-sign.ts`: let it take the text to spell instead of a model id, so the lot passes `modelLabel(model)` and the HQ passes the user

## 4. The HQ in the scene

- [x] 4.1 Keep a `Map<string, Hq>` by user in `web/main.ts`, filled and positioned from `syncPlaces()`: create what is missing, relocate what moved, and update every HQ with its user's total from `userTotals()`
- [x] 4.2 Sink and dispose the HQ of a user whose last session is gone, and check in the deferred callback that the user has not come back
- [x] 4.3 Hide a user's HQ in `applyDetailVisibility()` when the filter hides that user, and invalidate the shadow map when an HQ appears, moves, rebuilds or hides
- [x] 4.4 Tick the HQs in the frame loop next to the lots, and read their `consumeShadowDirty()` there
- [x] 4.5 Grep for anything that reads `plots.indexes().length` as a session count, and confirm every caller means "cells the city handed out"

## 5. Verify

- [x] 5.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, and `pnpm knip`
- [x] 5.2 Open `?mode=showcase` with agent-browser: four users with totals 0, 40M, 600M and 5B give HQs of 1, 3, 7 and 11 floors, each next to its own lots, and no yard holds a flagpole, helicopter, turbine or blimp
- [x] 5.3 Check a 5B HQ against the shadow camera and the fog far plane in `web/scene.ts`, and screenshot the tower from the default camera
- [x] 5.4 Check the filter panel: picking one user leaves one HQ and that user's lots
- [x] 5.5 Update the ladder table in `README.md` with the column for where a row stands

## 6. Hover details on the HQ

- [x] 6.1 Make `Hoverable` in `web/tooltip.ts` a union of a session and an HQ summary, with a builder per shape
- [x] 6.2 Give `Hq` a `hq` summary, `pickables()` and a `consumePickablesDirty()`, and mark its accent material `separate` so the plaza and lawns stay out of the pointer
- [x] 6.3 Count the sessions per user in `syncHqs`, pass it to the HQ, and fold the HQ pickables into `pickables()` in `web/main.ts`
- [x] 6.4 Style the two new lines in `web/style.css`, in both looks, and make the ink kicker read `HQ SIGNAL` over an HQ
- [x] 6.5 Extend `web/tests/hq.test.ts`: the summary, the hover target being the tower only, and the agent count not rebuilding the tower
