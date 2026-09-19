// Pure layout math for the industrial park. No Three.js, so it is easy to test.

import { claimedUpTo } from "./city-plan.ts";
import { plotCell } from "./plots.ts";

export const ACCENT_COUNT = 8;

// Same project name, same accent, also across users.
export function accentIndexFor(project: string): number {
  let hash = 0;
  for (const char of project) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % ACCENT_COUNT;
}

export const WALL_TINT_COUNT = 6;

// Same user, same hall color, also across reloads.
export function wallTintIndexFor(user: string): number {
  let hash = 0;
  for (const char of user) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % WALL_TINT_COUNT;
}

export type Bounds = { minCol: number; maxCol: number; minRow: number; maxRow: number };

// Tight bounds of the cells in use, plus, when `includeClaims` is set, the
// claimed cells the curve passes on its way to the highest rank. Those cells
// are built too, so a landmark on the edge would otherwise fall outside the
// camera and the shadow map. Only `Park.extent()` wants that: a per-user
// district box (see `districtBounds`) must stay a tight box around that
// user's own cells. Falls back to the first rank.
export function parkBounds(ranks: number[], includeClaims = false): Bounds {
  const used = ranks.length ? ranks : [0];
  const cells = [
    ...used.map(plotCell),
    ...(includeClaims ? claimedUpTo(Math.max(...used) + 1).map((claim) => claim.cell) : []),
  ];
  return {
    minCol: Math.min(...cells.map((c) => c.col)),
    maxCol: Math.max(...cells.map((c) => c.col)),
    minRow: Math.min(...cells.map((c) => c.row)),
    maxRow: Math.max(...cells.map((c) => c.row)),
  };
}

// Half the size of the park, with a margin of one and a half plots so the
// outer roads and verges are not cut off.
export const PARK_MARGIN_PLOTS = 1.5;

export function parkHalfExtent(bounds: Bounds, plotSize: number): number {
  const span = Math.max(bounds.maxCol - bounds.minCol, bounds.maxRow - bounds.minRow);
  return (span + PARK_MARGIN_PLOTS) * (plotSize / 2);
}

// The zoom that puts the whole park on screen. A square town seen
// isometrically is about 1.9 half extents tall and 3 wide.
export function fitZoom(halfExtent: number, viewHeight: number, viewWidth: number): number {
  return Math.min(viewHeight / (halfExtent * 1.9), viewWidth / (halfExtent * 3));
}

// How far the camera may zoom out. It has to be low enough that the park the
// project is designed for still fits: see the test next to this file, which
// pins 150 and 300 lots against this number.
//
// It was 0.08 while sessions owned every cell. The city plan claims about one
// cell in seven, so 300 sessions now span 360 curve indexes, which is where the
// Hilbert curve steps into a wider quadrant: 32 columns across instead of 24.
// The park got genuinely bigger, so the floor follows it down.
export const MIN_ZOOM = 0.06;
export const MAX_ZOOM = 4;

// One tight box per user district, plus the whole park's own box (parkBounds
// above already gives that, fed the union of every user's indexes). Meant
// for fase 4b: per-district LOD or culling instead of per-lot.
export type DistrictBounds = Bounds & { user: string };

export function districtBounds(indexesByUser: Map<string, number[]>): DistrictBounds[] {
  return [...indexesByUser].map(([user, indexes]) => ({ user, ...parkBounds(indexes) }));
}

export const MAX_MOVING_CARS = 6;

// Every lot sends 2 cars, busy or idle. A busy lot adds 1 per live subagent, up to 6.
export function movingCarCount(lotBusy: boolean, subagents: number): number {
  return Math.min(MAX_MOVING_CARS, 2 + (lotBusy ? subagents : 0));
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
