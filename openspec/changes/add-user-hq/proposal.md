## Why

The token ladder puts its extras in every yard of a user. A user with ten sessions gets ten helicopters, ten turbines and ten blimps, all at once. That reads as clutter instead of a reward, and it ties a machine's total to a session that happens to run right now. One HQ per user gives that total one place in the city, and a tower that grows a floor per row shows at a glance who has burned the most.

## What Changes

- Every user with at least one session gets one HQ. It stands on a plot of its own, the first plot of that user's run, so it sits next to that user's factories and gets the same roads, sidewalks, lamps and trees as a lot. A user with no sessions has no HQ, and the plot goes back to the city when the last session ends.
- The HQ is an office tower on a forecourt, in the same wall tint the user's halls already use, with the user's name in letters on the roof. Those are the same rooftop letters a hall spells its model with, so the letters take the text to show instead of a model id. Its height follows the ten rows of the ladder: a ground floor below 10M and one extra floor per unlocked row, so 5B stands eleven floors tall, about as tall as the Stevenskerk. When the total crosses a row, the tower is rebuilt in place, the way a lot is rebuilt today.
- Four rows move off the agent lots onto the HQ: the flagpole at 100M, the helipad with the helicopter at 1B (on the tower roof), the wind turbine at 2.5B (on the HQ plot), and the blimp at 5B (tethered above the tower). The turbine turns and the blimp bobs whether the sessions are busy or idle, as they do now.
- The other six rows stay in every yard, unchanged: bike rack at 10M, the 3 parked cars at 25M, 50M and 100M, coffee cart and picnic table at 250M, the truck at the dock bay at 500M, and the EV chargers with the sports car at 750M. The 100M row now adds only the 3rd car to the yard, because its flagpole moved.
- The HQ's total is the user's total as the ladder dialog already computes it: the highest machine total among that user's sessions. Two machines under one name keep the higher of the two, so a machine on protocol 2 does not reset the tower to one floor.
- Hovering an HQ shows a tooltip: the user's name, that it is a head office, how many sessions that user is running, and the token total. The block it stands on stays out of it, so the lawn and the plaza show nothing.
- The filter panel hides a user's HQ together with that user's lots.
- README: the ladder table gets a column for where an extra stands.

Not in this change: workers or traffic of its own, a footprint that grows with the total, an HQ for a user with no sessions, and a total that sums two machines instead of taking the highest.

## Capabilities

### New Capabilities

None. The HQ is part of the scene the `factory-scene` spec already covers.

### Modified Capabilities

- `factory-scene`: new requirement "User HQ" for the building, its plot, its height and its lifecycle; "Token milestones" gains a column for where each row stands and loses four rows from the yard.

## Impact

- Web: new `web/hq.ts` (the tower and its forecourt, rebuilt per floor count), `web/roof-sign.ts` (takes the text to spell instead of a model id), `web/milestones.ts` (the ten builders split into lot rows and HQ rows, the helipad and blimp anchored to a shape they are given), `web/milestone-ladder.ts` (floors per total, labels say where a row stands), `web/plots.ts` (one extra plot per user, first in that user's run), `web/lot.ts` (drops the four rows it no longer builds), `web/main.ts` (builds, places, filters and disposes the HQs next to the lots), `web/tooltip.ts` and `web/style.css` (a second shape of tooltip, for something that is not a session).
- Tests: the plot allocation with HQs in `web/tests/`, the floor count per total, and the split of the ladder rows over lot and HQ.
- Docs: `README.md`.
- No server change and no wire change: `machineTokens` already travels with every session.
