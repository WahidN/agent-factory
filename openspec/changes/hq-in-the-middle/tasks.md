## 1. Placement

- [x] 1.1 Change `assignPlots` so the HQ takes the rank nearest the centroid of its user's run, and update the comment that says an HQ stays put
- [x] 1.2 Update the plots test that expects the HQ in front of the run, and add tests for a run of 1, 2 and 5 (HQ is the plot nearest the middle, ties go to the lower rank)
- [x] 1.3 Add a test that the same sessions in a different order give the same layout, and that no plot is empty after a session leaves

## 2. Verify

- [x] 2.1 Grep for code that relies on the HQ being first in the run
- [x] 2.2 Run lint, typecheck, tests and build
- [x] 2.3 Check in the browser with `?mode=showcase` that each HQ has halls around it, with a screenshot
