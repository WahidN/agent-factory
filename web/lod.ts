// Decides which lots are drawn in full detail. Pure math, no Three.js, so the
// rule that keeps the frame budget flat is testable on its own.
//
// The cap is the whole point: a park of 150 lots costs the same per frame as a
// park of 20, because only the nearest `cap` lots are ever built in full. The
// rest come from the shared instanced meshes in instanced-lots.ts.

export type LotPoint = { id: string; x: number; z: number };

// How many lots keep their full detail. Measured on a 1600x900 window, whole
// park in view: 20 left a hard visible ring between the detailed factories and
// the boxes around them, and 60 cost 12598 draw calls at 52 ms a frame. 40 is
// the middle, and ?detail=N overrides it.
export const DEFAULT_DETAIL_CAP = 40;

// A lot that already has detail is ranked as if it were 15% closer. Without
// this, two lots within a pixel of each other swap places on every camera
// nudge, and a lot is torn down and rebuilt for nothing.
const DETAIL_STICKINESS = 0.85;

// How far the camera has to move over the ground before the set is worth
// recomputing. Well under half a plot (60 units), so detail follows the view
// without running the sort on every frame.
export const REDISTRIBUTE_DISTANCE = 20;

// And no more often than this. The camera glides to a new focus over about a
// second; without a floor on the interval that one glide would rebuild the
// detailed set twenty times over.
export const REDISTRIBUTE_INTERVAL_MS = 250;

// "?detail=40" raises or lowers the ceiling for one visit, so the cap can be
// tried against a real park without a rebuild. Anything that is not a whole
// number of zero or more falls back to the default.
export function detailCapFrom(search: string, fallback = DEFAULT_DETAIL_CAP): number {
  const raw = new URLSearchParams(search).get("detail");
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

type Ranked = { id: string; rank: number };

function byRankThenId(a: Ranked, b: Ranked): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// The ids that get the detailed lot, nearest first. `current` is the set that
// has detail right now; those get the stickiness bonus.
export function selectDetailed(
  camera: { x: number; z: number },
  lots: readonly LotPoint[],
  cap: number,
  current: ReadonlySet<string> = new Set(),
): string[] {
  if (cap <= 0) return [];
  const ranked = lots.map(({ id, x, z }): Ranked => {
    const distance = Math.hypot(x - camera.x, z - camera.z);
    return { id, rank: current.has(id) ? distance * DETAIL_STICKINESS : distance };
  });
  ranked.sort(byRankThenId);
  return ranked.slice(0, cap).map((entry) => entry.id);
}

// True when the camera has wandered far enough from where the set was last
// decided. Squared compare, so no square root on the frame path.
export function shouldRedistribute(
  from: { x: number; z: number },
  to: { x: number; z: number },
  distance = REDISTRIBUTE_DISTANCE,
): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return dx * dx + dz * dz >= distance * distance;
}
