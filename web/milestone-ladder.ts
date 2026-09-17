// The token ladder: which extras a machine's season token total has earned.
// Pure, no Three.js, so it is easy to test. The builders are in milestones.ts.

export const MILESTONES: readonly number[] = [10e6, 25e6, 50e6, 100e6, 250e6, 500e6, 750e6, 1e9, 2.5e9, 5e9];

// What each row adds, for the overview dialog. Same order as MILESTONES.
export const MILESTONE_LABELS: readonly string[] = [
  "bike rack with 3 bikes",
  "1st parked car",
  "2nd parked car",
  "3rd parked car and a flagpole",
  "coffee cart and picnic table",
  "truck at the dock bay",
  "EV chargers and a sports car",
  "helipad with a helicopter",
  "wind turbine",
  "blimp above the hall",
];

// How many rows of the ladder a total has reached, 0 to 10.
export function milestoneIndex(tokens: number): number {
  return MILESTONES.filter((threshold) => tokens >= threshold).length;
}

// Rows 2, 3 and 4 each add one parked car.
export function parkedCarCount(index: number): number {
  return Math.max(0, Math.min(3, index - 1));
}

export type LadderRow = { tokens: number; label: string; unlocked: boolean; toGo: number };

// The whole ladder as the dialog shows it: every row, unlocked or not, and what is left to go.
export function ladderRows(tokens: number): LadderRow[] {
  return MILESTONES.map((threshold, i) => ({
    tokens: threshold,
    label: MILESTONE_LABELS[i],
    unlocked: tokens >= threshold,
    toGo: Math.max(0, threshold - tokens),
  }));
}
