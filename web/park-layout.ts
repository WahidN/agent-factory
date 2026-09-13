// Pure layout math for the industrial park. No Three.js, so it is easy to test.

import { plotCell } from "./plots.ts";

export const ACCENT_COUNT = 8;

// Same folder, same accent.
export function accentIndexFor(cwd: string): number {
  let hash = 0;
  for (const char of cwd) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % ACCENT_COUNT;
}

export type Bounds = { minCol: number; maxCol: number; minRow: number; maxRow: number };

// Tight bounds of the cells in use. Falls back to the first cell.
export function parkBounds(indexes: number[]): Bounds {
  const cells = (indexes.length ? indexes : [0]).map(plotCell);
  return {
    minCol: Math.min(...cells.map((c) => c.col)),
    maxCol: Math.max(...cells.map((c) => c.col)),
    minRow: Math.min(...cells.map((c) => c.row)),
    maxRow: Math.max(...cells.map((c) => c.row)),
  };
}

export const MAX_MOVING_CARS = 6;

// A busy lot sends 2 cars, plus 1 per busy subagent, up to 6. Idle lots send none.
export function movingCarCount(lotBusy: boolean, busySubagents: number): number {
  return lotBusy ? Math.min(MAX_MOVING_CARS, 2 + busySubagents) : 0;
}

// A square loop of half size `half` around the lot center, driven clockwise
// as seen from above. `heading` is a rotation around y for a model facing +x.
export function roadLoopPoint(distance: number, half: number): { x: number; z: number; heading: number } {
  const side = half * 2;
  const d = ((distance % (side * 4)) + side * 4) % (side * 4);
  const along = d % side;
  const segment = Math.floor(d / side);
  const corners = [
    { x: -half, z: -half, dx: 1, dz: 0 },
    { x: half, z: -half, dx: 0, dz: 1 },
    { x: half, z: half, dx: -1, dz: 0 },
    { x: -half, z: half, dx: 0, dz: -1 },
  ];
  const c = corners[segment];
  return { x: c.x + c.dx * along, z: c.z + c.dz * along, heading: Math.atan2(-c.dz, c.dx) };
}

// One forklift trip per phase 0..1: lift at `from`, drive to `to`, lower, drive back empty.
export function forkliftPose(phase: number, from: number, to: number): { z: number; fork: number; carrying: boolean } {
  const p = ((phase % 1) + 1) % 1;
  const ease = (t: number) => t * t * (3 - 2 * t);
  if (p < 0.15) return { z: from, fork: p / 0.15, carrying: true };
  if (p < 0.5) return { z: from + (to - from) * ease((p - 0.15) / 0.35), fork: 1, carrying: true };
  if (p < 0.65) return { z: to, fork: 1 - (p - 0.5) / 0.15, carrying: true };
  return { z: to + (from - to) * ease((p - 0.65) / 0.35), fork: 0, carrying: false };
}
