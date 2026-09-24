// The fixed north-south railway through Nijmegen. It is deliberately separate
// from the road graph: ballast, fences and catenary make the right-of-way read
// as rail infrastructure, while the bridge fills the only gap over the Waal.

import type { Cell } from "./city-plan.ts";
import { isWaterEdge, RAIL_BRIDGE, RAIL_BRIDGE_SPAN, WAAL_EDGE } from "./city-plan.ts";
import { MATERIALS, standard } from "./palette.ts";
import { PLOT_SIZE, ROAD_WIDTH } from "./plots.ts";
import type { StaticBuilder } from "./static-builder.ts";

export const RAIL_X = (RAIL_BRIDGE.col - 0.5) * PLOT_SIZE;
export const RAIL_PEDESTRIAN_CLEARANCE = 5.5;

const waterZ = (WAAL_EDGE - 0.5) * PLOT_SIZE;
const ballast = standard("#77756f", { roughness: 1 });
export const railSteel = standard("#4b555c", { roughness: 0.55, metalness: 0.5 });
const fenceSteel = standard("#687177", { roughness: 0.72, metalness: 0.28 });

export type RailSegment = { from: number; to: number };

export function railSegmentsForCells(cells: readonly Cell[]): RailSegment[] {
  // The rails sit on the boundary between these two cell columns. Only rows
  // that actually touch that boundary should receive track; using the global
  // city bounds drew rails, fencing and overhead wire through empty meadow.
  const rows = [
    ...new Set(cells.filter(({ col }) => col === RAIL_BRIDGE.col - 1 || col === RAIL_BRIDGE.col).map(({ row }) => row)),
  ].sort((a, b) => a - b);
  if (rows.length === 0) return [];

  const runs: { first: number; last: number }[] = [];
  for (const row of rows) {
    const run = runs.at(-1);
    if (run && row === run.last + 1) run.last = row;
    else runs.push({ first: row, last: row });
  }

  const bridgeFrom = waterZ - RAIL_BRIDGE_SPAN / 2;
  const bridgeTo = waterZ + RAIL_BRIDGE_SPAN / 2;
  return runs.flatMap(({ first, last }) => {
    const from = (first - 0.5) * PLOT_SIZE;
    const to = (last + 0.5) * PLOT_SIZE;
    return [
      { from, to: Math.min(to, bridgeFrom) },
      { from: Math.max(from, bridgeTo), to },
    ].filter((segment) => segment.to - segment.from > 0.1);
  });
}

/** Keeps static crowds and visitors outside the fenced rail right-of-way. */
export function railSafeX(x: number): number {
  const distance = x - RAIL_X;
  if (Math.abs(distance) >= RAIL_PEDESTRIAN_CLEARANCE) return x;
  return RAIL_X + (distance < 0 ? -RAIL_PEDESTRIAN_CLEARANCE : RAIL_PEDESTRIAN_CLEARANCE);
}

// Every east-west road on a row boundary crosses the track on the level, so
// the bed and fence stop for the road width there. Only the rails run through.
function bedBetweenCrossings({ from, to }: RailSegment): RailSegment[] {
  const pieces: RailSegment[] = [];
  let start = from;
  for (let row = Math.floor(from / PLOT_SIZE); row <= Math.ceil(to / PLOT_SIZE) + 1; row++) {
    if (isWaterEdge(row)) continue;
    const roadZ = (row - 0.5) * PLOT_SIZE;
    if (roadZ + ROAD_WIDTH / 2 <= start || roadZ - ROAD_WIDTH / 2 >= to) continue;
    pieces.push({ from: start, to: roadZ - ROAD_WIDTH / 2 });
    start = roadZ + ROAD_WIDTH / 2;
  }
  pieces.push({ from: start, to });
  return pieces.filter((piece) => piece.to - piece.from > 0.1);
}

export function appendRailCorridor(builder: StaticBuilder, cells: readonly Cell[]) {
  for (const segment of railSegmentsForCells(cells)) {
    const length = segment.to - segment.from;
    const center = (segment.from + segment.to) / 2;
    for (const x of [RAIL_X - 1.05, RAIL_X + 1.05]) {
      builder.box(railSteel, [x, 0.27, center], [0.16, 0.16, length]);
    }
    builder.box(fenceSteel, [RAIL_X, 5.1, center], [0.07, 0.07, length]);

    for (const { from, to } of bedBetweenCrossings(segment)) {
      const pieceLength = to - from;
      const pieceCenter = (from + to) / 2;
      builder.box(ballast, [RAIL_X, 0.05, pieceCenter], [8.6, 0.2, pieceLength]);
      for (let z = from + 1; z < to; z += 2) {
        builder.box(MATERIALS.wood, [RAIL_X, 0.15, z], [5.6, 0.16, 0.42]);
      }

      // Fencing between the crossings keeps the corridor from reading as a
      // road or promenade; sparse catenary masts add the Dutch rail rhythm.
      for (const side of [-1, 1]) {
        const fenceX = RAIL_X + side * 4.55;
        builder.box(fenceSteel, [fenceX, 1.15, pieceCenter], [0.1, 0.12, pieceLength]);
        for (let z = from + 2; z < to; z += 8) {
          builder.box(fenceSteel, [fenceX, 0.6, z], [0.1, 1.2, 0.1]);
        }
      }
      for (let z = from + 4; z < to; z += 20) {
        builder.box(fenceSteel, [RAIL_X + 4, 2.55, z], [0.16, 5.1, 0.16]);
        builder.box(fenceSteel, [RAIL_X + 2, 5, z], [4, 0.12, 0.12]);
      }
    }
  }
}
