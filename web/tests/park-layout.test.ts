import { describe, expect, it } from "vitest";
import {
  ACCENT_COUNT,
  accentIndexFor,
  districtBounds,
  fitZoom,
  forkliftPose,
  MIN_ZOOM,
  movingCarCount,
  parkBounds,
  parkHalfExtent,
  WALL_TINT_COUNT,
  wallTintIndexFor,
} from "../park-layout.ts";
import { assignPlots, PLOT_SIZE, plotCell } from "../plots.ts";

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
    expect(bounds).toEqual({ minCol: 0, maxCol: 2, minRow: 0, maxRow: 1 });
  });

  it("falls back to the first cell when nothing is used", () => {
    expect(parkBounds([])).toEqual({ minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 });
  });
});

describe("districtBounds", () => {
  // The compact layout no longer reserves a private area per user (that is
  // what made the park too big to fit), so two users' boxes may overlap.
  // What districtBounds still owes fase 4b is one tight box per user, built
  // from exactly that user's own cells.
  it("gives each user a tight box around their own cells", () => {
    const sessions = [
      { id: "s1", user: "dennis" },
      { id: "s2", user: "dennis" },
      { id: "s3", user: "wahid" },
    ];
    const assignment = assignPlots(sessions);
    const byUser = new Map<string, number[]>();
    for (const { id, user } of sessions) {
      const indexes = byUser.get(user) ?? [];
      indexes.push(assignment.get(id)!);
      byUser.set(user, indexes);
    }

    const bounds = districtBounds(byUser);
    expect(bounds).toHaveLength(2);
    for (const { user, ...box } of bounds) {
      expect(box).toEqual(parkBounds(byUser.get(user)!));
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

  it("names the zoom each size needs, so a change to the floor is deliberate", () => {
    expect(zoomForLots(150)).toBeCloseTo(0.156, 3);
    expect(zoomForLots(300)).toBeCloseTo(0.114, 3);
  });
});
