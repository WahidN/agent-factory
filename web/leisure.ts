// A quiet lot's leisure destination: where its workers go when the session is
// idle. The only place that turns a claimed cell (city-plan.ts) into a world
// point (plots.ts, Point from worker-logic.ts), kept out of city-plan.ts so
// that module never has to know about world coordinates.

import { CELL_HALF } from "./cell-build.ts";
import { type Cell, nearestClaim } from "./city-plan.ts";
import { plotCell, plotPosition, PLOT_SIZE } from "./plots.ts";
import type { Point } from "./worker-logic.ts";

// A destination point just inside the edge of `cell` that faces `from`, plus
// which axis runs along that edge (so callers can spread several workers
// along it instead of piling them on one spot). The point sits at the cell's
// center on the axis it does not offset.
export function edgePoint(cell: Cell, from: Cell): { point: Point; axis: "x" | "z" } {
  const colDiff = from.col - cell.col;
  const rowDiff = from.row - cell.row;
  const onXEdge = Math.abs(colDiff) >= Math.abs(rowDiff);
  return {
    point: {
      x: cell.col * PLOT_SIZE + (onXEdge ? Math.sign(colDiff) * CELL_HALF : 0),
      z: cell.row * PLOT_SIZE + (onXEdge ? 0 : Math.sign(rowDiff) * CELL_HALF),
    },
    axis: onXEdge ? "z" : "x",
  };
}

// A quiet lot's leisure destination, in coordinates local to its own plot
// (the edge point's world position minus the lot's own), plus the axis to
// spread workers along: the pure half of what a Lot needs to send its
// workers to the nearest claimed cell, on the stoep or the grass around it
// rather than inside it. Recomputed whenever `rank` or `rankCount` changes,
// since both shift with the packed layout (see plots.ts).
export function destinationFor(rank: number, rankCount: number): { point: Point; axis: "x" | "z" } | null {
  const own = plotPosition(rank);
  const ownCell = plotCell(rank);
  const cell = nearestClaim(ownCell, rankCount);
  if (!cell) return null;
  const { point, axis } = edgePoint(cell, ownCell);
  return { point: { x: point.x - own.x, z: point.z - own.z }, axis };
}
