import { describe, expect, it } from "vitest";
import {
  ACCENT_COUNT,
  accentIndexFor,
  fitZoom,
  forkliftPose,
  MIN_ZOOM,
  movingCarCount,
  parkBounds,
  parkHalfExtent,
  WALL_TINT_COUNT,
  wallTintIndexFor,
} from "../park-layout.ts";
import { claimedUpTo } from "../city-plan.ts";
import { PLOT_SIZE, plotCell } from "../plots.ts";

describe("accentIndexFor", () => {
  it("gives the same accent for the same project", () => {
    expect(accentIndexFor("/Volumes/Based/Projects")).toBe(accentIndexFor("/Volumes/Based/Projects"));
  });

  it("stays within the palette", () => {
    for (const cwd of ["/a", "/b/c", "/Users/me/shop", ""]) {
      const index = accentIndexFor(cwd);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(ACCENT_COUNT);
    }
  });
});

describe("wallTintIndexFor", () => {
  it("gives the same hall color for the same user", () => {
    expect(wallTintIndexFor("dennispassway")).toBe(wallTintIndexFor("dennispassway"));
  });

  it("stays within the palette", () => {
    for (const user of ["a", "wahid", "dennispassway", ""]) {
      const index = wallTintIndexFor(user);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(WALL_TINT_COUNT);
    }
  });

  // These are the two users that sit side by side in practice; the hash
  // must split them so their halls are visibly different colors.
  it("gives different colors for the two users in the office", () => {
    expect(wallTintIndexFor("dennispassway")).not.toBe(wallTintIndexFor("wahid"));
  });
});

describe("parkBounds", () => {
  it("tightly covers the used cells", () => {
    const indexes = [0, 1, 2, 5];
    const bounds = parkBounds(indexes);
    for (const { col, row } of indexes.map(plotCell)) {
      expect(col).toBeGreaterThanOrEqual(bounds.minCol);
      expect(col).toBeLessThanOrEqual(bounds.maxCol);
      expect(row).toBeGreaterThanOrEqual(bounds.minRow);
      expect(row).toBeLessThanOrEqual(bounds.maxRow);
    }
    // Tight means every edge is touched by a cell, rather than a fixed pair
    // of coordinates: the order indexes walk is free to change.
    const cells = indexes.map(plotCell);
    expect(Math.min(...cells.map((c) => c.col))).toBe(bounds.minCol);
    expect(Math.max(...cells.map((c) => c.col))).toBe(bounds.maxCol);
    expect(Math.min(...cells.map((c) => c.row))).toBe(bounds.minRow);
    expect(Math.max(...cells.map((c) => c.row))).toBe(bounds.maxRow);
  });

  it("falls back to the first rank when nothing is used", () => {
    expect(parkBounds([])).toEqual({ minCol: 1, maxCol: 1, minRow: 0, maxRow: 0 });
  });

  it("still falls back to the first rank when nothing is used, claims included", () => {
    // Rank 0 sits on cell 1:0 and the curve has already passed the Goffert on
    // 0:0 by then, so an empty park is two cells wide, not one.
    expect(parkBounds([], true)).toEqual({ minCol: 0, maxCol: 1, minRow: 0, maxRow: 0 });
  });

  it("covers the claimed cells too, so a landmark on the edge stays in frame", () => {
    const bounds = parkBounds([0, 1, 2, 5], true);
    for (const { cell } of claimedUpTo(6)) {
      expect(cell.col).toBeGreaterThanOrEqual(bounds.minCol);
      expect(cell.col).toBeLessThanOrEqual(bounds.maxCol);
      expect(cell.row).toBeGreaterThanOrEqual(bounds.minRow);
      expect(cell.row).toBeLessThanOrEqual(bounds.maxRow);
    }
  });
});

describe("movingCarCount", () => {
  it("sends 2 cars from an idle lot", () => {
    expect(movingCarCount(false, 0)).toBe(2);
    expect(movingCarCount(false, 3)).toBe(2);
  });

  it("sends 2 cars plus 1 per busy subagent, up to 6", () => {
    expect(movingCarCount(true, 0)).toBe(2);
    expect(movingCarCount(true, 3)).toBe(5);
    expect(movingCarCount(true, 4)).toBe(6);
    expect(movingCarCount(true, 6)).toBe(6);
  });
});

describe("forkliftPose", () => {
  it("stays within its path and forks stay in 0..1", () => {
    for (let phase = 0; phase < 3; phase += 0.01) {
      const pose = forkliftPose(phase, -2.5, 3);
      expect(pose.z).toBeGreaterThanOrEqual(-2.5 - 1e-9);
      expect(pose.z).toBeLessThanOrEqual(3 + 1e-9);
      expect(pose.fork).toBeGreaterThanOrEqual(0);
      expect(pose.fork).toBeLessThanOrEqual(1);
    }
  });

  it("carries on the way out and returns empty", () => {
    expect(forkliftPose(0.3, -2.5, 3).carrying).toBe(true);
    expect(forkliftPose(0.8, -2.5, 3).carrying).toBe(false);
    expect(forkliftPose(0.5, -2.5, 3).z).toBeCloseTo(3);
  });
});

// The project is designed for 150 lots and tested at 300. A zoom floor that
// sits above the zoom those need silently crops the park, which is what the
// old floor of 0.3 did from 37 lots onward.
describe("the park fits on screen", () => {
  const VIEW_HEIGHT = 120; // must match web/scene.ts
  const WIDE = (VIEW_HEIGHT * 16) / 9;

  function zoomForLots(count: number): number {
    const indexes = Array.from({ length: count }, (_, i) => i);
    return fitZoom(parkHalfExtent(parkBounds(indexes), PLOT_SIZE), VIEW_HEIGHT, WIDE);
  }

  it("still fits at 150 lots", () => {
    expect(zoomForLots(150)).toBeGreaterThanOrEqual(MIN_ZOOM);
  });

  it("still fits at 300 lots, the size the park is tested at", () => {
    expect(zoomForLots(300)).toBeGreaterThanOrEqual(MIN_ZOOM);
  });

  // The city plan claims cells, so 300 sessions now walk 360 curve indexes and
  // the park runs 32 columns wide instead of 24. 150 lots still need the same
  // zoom; 300 lots need about 0.065, which is why MIN_ZOOM dropped from 0.08
  // to 0.06 in the same change: 0.065 sits just above the new floor. Claims
  // more cells (or hands out filler more often via FILLER_EVERY) and this
  // number sinks under the floor again, so the values are pinned here.
  it("names the zoom each size needs, so a change to the floor is deliberate", () => {
    expect(zoomForLots(150)).toBeCloseTo(0.128, 3);
    expect(zoomForLots(300)).toBeCloseTo(0.065, 3);
  });
});
