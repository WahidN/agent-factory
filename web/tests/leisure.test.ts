import { describe, expect, it } from "vitest";
import { CELL_HALF } from "../cell-build.ts";
import { destinationFor, edgePoint } from "../leisure.ts";
import { nearestClaim } from "../city-plan.ts";
import { plotCell, plotPosition, PLOT_SIZE } from "../plots.ts";

describe("edgePoint", () => {
  it("nudges toward the lot along the axis the lot differs most on", () => {
    // The lot sits three columns west and one row north of the cell: the
    // column difference dominates, so the point sits on the cell's west edge.
    const { point, axis } = edgePoint({ col: 5, row: 2 }, { col: 2, row: 3 });
    expect(point).toEqual({ x: 5 * PLOT_SIZE - CELL_HALF, z: 2 * PLOT_SIZE });
    expect(axis).toBe("z");
  });

  it("nudges along the row when the lot differs more in row than column", () => {
    const { point, axis } = edgePoint({ col: 5, row: 2 }, { col: 6, row: 5 });
    expect(point).toEqual({ x: 5 * PLOT_SIZE, z: 2 * PLOT_SIZE + CELL_HALF });
    expect(axis).toBe("x");
  });

  it("stays inside the cell, never past CELL_HALF from its center", () => {
    for (const from of [
      { col: 0, row: 0 },
      { col: 9, row: 1 },
      { col: 3, row: -4 },
    ]) {
      const cell = { col: 5, row: 2 };
      const { point } = edgePoint(cell, from);
      expect(Math.abs(point.x - cell.col * PLOT_SIZE)).toBeLessThanOrEqual(CELL_HALF);
      expect(Math.abs(point.z - cell.row * PLOT_SIZE)).toBeLessThanOrEqual(CELL_HALF);
    }
  });
});

describe("destinationFor", () => {
  it("is null for an empty city", () => {
    expect(destinationFor(0, 0)).toBeNull();
  });

  it("points at the edge of the claimed cell, in coordinates local to the lot's own plot", () => {
    for (const rank of [0, 5, 20]) {
      const destination = destinationFor(rank, 300)!;
      const own = plotPosition(rank);
      const ownCell = plotCell(rank);
      const cell = nearestClaim(ownCell, 300)!;
      const worldX = own.x + destination.point.x;
      const worldZ = own.z + destination.point.z;
      expect(Math.abs(worldX - cell.col * PLOT_SIZE)).toBeLessThanOrEqual(CELL_HALF);
      expect(Math.abs(worldZ - cell.row * PLOT_SIZE)).toBeLessThanOrEqual(CELL_HALF);
      // Never dead center: it sits on the edge facing the lot's own cell.
      expect(worldX === cell.col * PLOT_SIZE && worldZ === cell.row * PLOT_SIZE).toBe(false);
    }
  });

  it("gives a different local point after a rank change, still aimed at the same claimed cell", () => {
    // Two ranks that share the same nearest claim: a rank change here only
    // repacks the lot's own plot, it does not change the target, exactly
    // what happens when another session starts or stops elsewhere in the park.
    let rankA = -1;
    let rankB = -1;
    let target: { col: number; row: number } | null = null;
    outer: for (let a = 0; a < 50; a++) {
      const cellA = nearestClaim(plotCell(a), 300);
      for (let b = a + 1; b < 50; b++) {
        const cellB = nearestClaim(plotCell(b), 300);
        if (cellA && cellB && cellA.col === cellB.col && cellA.row === cellB.row) {
          rankA = a;
          rankB = b;
          target = cellA;
          break outer;
        }
      }
    }
    expect(target).not.toBeNull();

    const destA = destinationFor(rankA, 300)!;
    const destB = destinationFor(rankB, 300)!;
    const ownA = plotPosition(rankA);
    const ownB = plotPosition(rankB);

    expect(destA).not.toEqual(destB);
    for (const [own, dest] of [
      [ownA, destA],
      [ownB, destB],
    ] as const) {
      expect(Math.abs(own.x + dest.point.x - target!.col * PLOT_SIZE)).toBeLessThanOrEqual(CELL_HALF);
      expect(Math.abs(own.z + dest.point.z - target!.row * PLOT_SIZE)).toBeLessThanOrEqual(CELL_HALF);
    }
  });
});
