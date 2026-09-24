import { describe, expect, it } from "vitest";
import { ladderRows, MILESTONE_LABELS, MILESTONES, milestoneIndex, parkedCarCount } from "../milestone-ladder.ts";

describe("milestoneIndex", () => {
  it("is 0 below the first row", () => {
    expect(milestoneIndex(0)).toBe(0);
    expect(milestoneIndex(9_999_999)).toBe(0);
  });

  it("counts a row from its threshold on, not one token before", () => {
    MILESTONES.forEach((threshold, i) => {
      expect(milestoneIndex(threshold)).toBe(i + 1);
      expect(milestoneIndex(threshold - 1)).toBe(i);
    });
  });

  it("stays at the top far above 5B", () => {
    expect(milestoneIndex(5e9)).toBe(10);
    expect(milestoneIndex(1e12)).toBe(10);
  });

  it("has the agreed ladder", () => {
    expect(MILESTONES).toEqual([10e6, 25e6, 50e6, 100e6, 250e6, 500e6, 750e6, 1e9, 2.5e9, 5e9]);
  });
});

describe("parkedCarCount", () => {
  it("adds one car for each of rows 2 to 4", () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(parkedCarCount)).toEqual([0, 0, 1, 2, 3, 3, 3]);
  });
});

describe("ladderRows", () => {
  it("has one row per milestone, with a label", () => {
    const rows = ladderRows(0);
    expect(rows).toHaveLength(MILESTONES.length);
    expect(rows.map((row) => row.label)).toEqual([...MILESTONE_LABELS]);
  });

  it("locks every row at 0 and counts the full threshold as still to go", () => {
    const rows = ladderRows(0);
    expect(rows.some((row) => row.unlocked)).toBe(false);
    expect(rows[0].toGo).toBe(10e6);
  });

  it("unlocks the rows at or below the total", () => {
    const rows = ladderRows(600e6);
    expect(rows.filter((row) => row.unlocked).map((row) => row.tokens)).toEqual([
      10e6, 25e6, 50e6, 100e6, 250e6, 500e6,
    ]);
    expect(rows.find((row) => row.tokens === 750e6)).toMatchObject({ unlocked: false, toGo: 150e6 });
  });

  it("unlocks everything at 5B and leaves nothing to go", () => {
    const rows = ladderRows(5e9);
    expect(rows.every((row) => row.unlocked)).toBe(true);
    expect(rows.every((row) => row.toGo === 0)).toBe(true);
  });
});
