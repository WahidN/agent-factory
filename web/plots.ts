// Gives each session a plot index that is a pure function of the whole set
// of sessions currently on the park: no arrival order, no counter, no state
// that depends on history. The same set of sessions always lays out the same
// way for every viewer. Removing a session may shift others (the park stays
// compact, gaps are not kept open for a session that left), but the layout
// never depends on the order sessions were added or removed in.
// Plot 0 is a corner and the town grows outward along a Hilbert curve.
//
// A session gets a rank, not a cell: the cells the city plan claims (see
// city-plan.ts) are skipped, so sessions flow around the parks and landmarks
// instead of pushing them aside.

import { indexForRank } from "./city-plan.ts";

export const PLOT_SIZE = 60;
export const ROAD_WIDTH = 10;

type PlotSession = { id: string; user: string };

// FNV-ish string hash: cheap, and different enough that two unrelated ids or
// usernames very rarely land in the same bucket.
export function hashString(value: string): number {
  let hash = 0;
  for (const char of value) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return hash;
}

// A stable order for a set of keys: by hash first, then by the key itself.
// Two keys that hash the same never tie, so the order stays deterministic
// even under a collision, and it never depends on the order the keys were
// given in.
function sortedByHash(keys: string[]): string[] {
  return [...new Set(keys)].sort((a, b) => {
    const diff = hashString(a) - hashString(b);
    if (diff !== 0) return diff;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

// Assigns every session a plot index, packed into 0..sessions.length-1 with
// no gaps: the park's footprint only ever depends on how many sessions there
// are, the same as if they all belonged to one user, never on how many
// users share them. Users are sorted deterministically and each user's
// sessions (also sorted deterministically) form one contiguous run of
// indexes, so a user's plots stay next to each other. Because the packing is
// exact, removing a session shifts the ranks (and so the positions) of
// whichever sessions came after it in this order; that is expected, not a
// bug, it is what keeps the park compact.
export function assignPlots(sessions: PlotSession[]): Map<string, number> {
  const byUser = new Map<string, string[]>();
  for (const { id, user } of sessions) {
    const ids = byUser.get(user);
    if (ids) ids.push(id);
    else byUser.set(user, [id]);
  }

  const result = new Map<string, number>();
  let index = 0;
  for (const user of sortedByHash([...byUser.keys()])) {
    for (const id of sortedByHash(byUser.get(user)!)) {
      result.set(id, index);
      index++;
    }
  }
  return result;
}

// Recomputes the layout only when the set of sessions changes, so per-frame
// lookups (indexOf, indexes) stay cheap instead of resorting everything.
export class PlotAllocator {
  private sessions = new Map<string, string>(); // id -> user
  private cache: Map<string, number> | null = null;

  assign(id: string, user: string): number {
    if (!this.sessions.has(id)) {
      this.sessions.set(id, user);
      this.cache = null;
    }
    return this.recompute().get(id)!;
  }

  release(id: string) {
    if (this.sessions.delete(id)) this.cache = null;
  }

  indexOf(id: string): number | undefined {
    return this.recompute().get(id);
  }

  indexes(): number[] {
    return [...this.recompute().values()];
  }

  private recompute(): Map<string, number> {
    if (!this.cache) {
      this.cache = assignPlots([...this.sessions].map(([id, user]) => ({ id, user })));
    }
    return this.cache;
  }
}

// Indexes walk a Hilbert curve, so a run of consecutive indexes lands in a
// compact blob rather than a line. That is what puts one user's sessions next
// to each other: assignPlots hands each user a contiguous run, and the curve
// keeps that run compact near the edge of the park instead of stretching it
// into a diagonal streak.
//
// The curve is a fixed order 6 (64 by 64, 4096 cells) so that the cell for an
// index never depends on how many sessions are on the park. Beyond 4096 lots
// the grid wraps onto itself; the park is designed for 150 and tested at 300.
const CURVE_SIDE = 64;

// The raw curve: index -> cell, city plan and all.
export function curveCell(index: number): { col: number; row: number } {
  let col = 0;
  let row = 0;
  let rest = index % (CURVE_SIDE * CURVE_SIDE);
  for (let size = 1; size < CURVE_SIDE; size *= 2) {
    const flipX = 1 & (rest >> 1);
    const flipY = 1 & (rest ^ flipX);
    [col, row] = rotate(size, col, row, flipX, flipY);
    col += size * flipX;
    row += size * flipY;
    rest >>= 2;
  }
  return { col, row };
}

// Reflects a quadrant so the curve stays connected where quadrants meet.
function rotate(size: number, col: number, row: number, flipX: number, flipY: number): [number, number] {
  if (flipY !== 0) return [col, row];
  return flipX === 1 ? [size - 1 - row, size - 1 - col] : [row, col];
}

// A session's cell. Ranks run over the cells the city plan left free, so a
// park, a church or the Goffert keeps its cell however many sessions come and
// go around it. Everything downstream (roads, bounds, traffic) works in ranks.
export function plotCell(rank: number): { col: number; row: number } {
  return curveCell(indexForRank(rank));
}

export function plotPosition(rank: number): { x: number; z: number } {
  const { col, row } = plotCell(rank);
  return { x: col * PLOT_SIZE, z: row * PLOT_SIZE };
}
