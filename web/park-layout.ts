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
// camera and the shadow map. Falls back to the first rank.
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
const PARK_MARGIN_PLOTS = 1.5;

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
// The city plan claims about one cell in seven, so 300 sessions span 360
// curve indexes, past where the Hilbert curve steps into a wider quadrant (32
// columns across instead of 24). The floor has to fit that wider park in a
// narrow window too: at aspect 0.6 it needs about 0.025.
export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 4;

// How far the user may zoom out for the park in view: a little past the zoom
// that fits it whole, so zooming out never shrinks the city to a speck.
export function zoomFloor(fittedZoom: number): number {
  return Math.max(MIN_ZOOM, fittedZoom * 0.8);
}

// The orbit target, held within the park's square half extent (which already
// carries a margin of one and a half plots) around its center.
export function clampToPark(
  x: number,
  z: number,
  park: { x: number; z: number; half: number },
): { x: number; z: number } {
  return {
    x: Math.min(park.x + park.half, Math.max(park.x - park.half, x)),
    z: Math.min(park.z + park.half, Math.max(park.z - park.half, z)),
  };
}

// Where the fog starts and ends, in world units past the point the camera
// looks at. A small park keeps a fixed 300..850; a bigger one pushes it out
// with its half extent, so the far corner (about 0.85 half extents past the
// center of a 300 lot park) stays clear.
export function fogRange(halfExtent: number): { near: number; far: number } {
  return { near: Math.max(300, halfExtent), far: Math.max(850, halfExtent * 1.6) };
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
