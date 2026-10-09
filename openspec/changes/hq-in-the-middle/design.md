## Context

`assignPlots` in `web/plots.ts` gives each user one run of consecutive ranks, sorted by hash. The HQ takes the first rank of the run and the sessions follow. Ranks map to cells through `plotPosition`, which walks a Hilbert curve and skips cells the city plan claims. A run of consecutive ranks is a compact blob, but its first rank is a corner of it.

## Decisions

**Pick the rank by position, keep the run.** For a run of n + 1 ranks, take the centroid of the cells (from `plotPosition`) and pick the rank whose cell is nearest to it. Ties go to the lower rank. The sessions take the other ranks in hash order. The run stays contiguous, so roads, bounds and the camera work as today.

**Pure and local.** The pick uses only the run's own cells, so it needs no state and the layout stays a function of the set of sessions. The change is in `assignPlots` and nothing else in the allocator.

**Trade-off: the HQ moves.** Today the first rank of the run never changes when one session joins or leaves, so the HQ stays put. With a centre pick, the middle shifts with the run, so the HQ can jump to a neighbouring plot when a session starts or stops. The old comment in `assignPlots` says an HQ stays where it stands, and it has to change. The HQ rises and sinks like a lot, so a move reads as one HQ sinking and one rising. Accepted, because the other option is keeping the HQ on the edge.

**Not a ring.** Nearest to the centroid does not promise halls on all four sides. For a run of 2 the HQ is one of two plots. For a run along a curve bend the middle may touch the blob's edge. A guarantee would need a different shape of run, which is a bigger change.

## Risks

- Anything that assumed "HQ is the first plot of the run" breaks. The test that asserts it changes, and `main.ts` and `milestones` only use the HQ's index, so they should not care. Check with grep.
- Two users' HQs can end up closer to each other. That is a side effect of the curve and not new.

## Assumptions

- "In the middle" means the middle of that user's own run, not the middle of the city.
