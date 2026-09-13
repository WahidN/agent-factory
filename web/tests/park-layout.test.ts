import { describe, expect, it } from "vitest";
import { ACCENT_COUNT, accentIndexFor, forkliftPose, movingCarCount, parkBounds, roadLoopPoint } from "../park-layout.ts";
import { plotCell } from "../plots.ts";

describe("accentIndexFor", () => {
  it("gives the same accent for the same folder", () => {
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

describe("movingCarCount", () => {
  it("sends no cars from an idle lot", () => {
    expect(movingCarCount(false, 0)).toBe(0);
    expect(movingCarCount(false, 3)).toBe(0);
  });

  it("sends 2 cars plus 1 per busy subagent, up to 6", () => {
    expect(movingCarCount(true, 0)).toBe(2);
    expect(movingCarCount(true, 3)).toBe(5);
    expect(movingCarCount(true, 4)).toBe(6);
    expect(movingCarCount(true, 6)).toBe(6);
  });
});

describe("roadLoopPoint", () => {
  const half = 27.5;

  it("is continuous, including across corners", () => {
    let previous = roadLoopPoint(0, half);
    for (let d = 0.5; d <= half * 8; d += 0.5) {
      const point = roadLoopPoint(d, half);
      expect(Math.hypot(point.x - previous.x, point.z - previous.z)).toBeLessThanOrEqual(0.5 + 1e-9);
      previous = point;
    }
  });

  it("stays on the square and wraps after one lap", () => {
    for (let d = 0; d < half * 8; d += 3.3) {
      const { x, z } = roadLoopPoint(d, half);
      expect(Math.max(Math.abs(x), Math.abs(z))).toBeCloseTo(half);
    }
    const start = roadLoopPoint(10, half);
    const lap = roadLoopPoint(10 + half * 8, half);
    expect(lap.x).toBeCloseTo(start.x);
    expect(lap.z).toBeCloseTo(start.z);
  });

  it("faces the direction of travel", () => {
    const a = roadLoopPoint(5, half);
    const b = roadLoopPoint(6, half);
    // A model facing +x rotated by heading points along (cos h, -sin h).
    expect(Math.cos(a.heading)).toBeCloseTo(b.x - a.x);
    expect(-Math.sin(a.heading)).toBeCloseTo(b.z - a.z);
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
