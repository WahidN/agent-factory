## Why

An HQ now stands on the first plot of its user's run, so it sits at the edge of its user's block of lots. The HQ is the centre of a user's yard, so it should stand in the middle with the halls around it.

## What Changes

- Per user, the HQ takes the plot of that user's run that lies closest to the middle of the run. The user's halls take the other plots of the run, in the same order as today.
- A user with one session gets an HQ and one hall, and one of them still has to be the middle. A bigger run gets halls on several sides of the HQ.
- The HQ moves to a new plot when the user's run changes, because the middle of the run moves. It no longer stays put when one of that user's sessions starts or stops.
- The run itself does not change: one run per user, no gaps, the same users in the same order, and the park stays compact.

Not in this change: a bigger HQ forecourt, placing HQs of different users near each other, and a guarantee that halls stand on every side. That depends on the shape of the run along the curve.

## Capabilities

### New Capabilities

- `hq-placement`: which plot of a user's run the HQ stands on.

### Modified Capabilities

None. The requirement "User HQ" is still in the open change `add-user-hq` and not in the main specs yet, so this change adds its own capability.

## Impact

- Web: `web/plots.ts` (`assignPlots` picks the HQ plot by position), `web/tests/plots.test.ts`.
- No server change, no new message, nothing changes in how an HQ or a hall is built.
- Builds on `add-user-hq`. This branch starts from `main`, which has it.
