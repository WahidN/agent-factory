// The city plan: which cells are not for sale.
//
// Sessions are packed onto the Hilbert curve by rank (see plots.ts). That
// packing shifts every cell whenever a session starts or stops, so anything
// placed on "a cell that happens to be free" would wander through the city.
// Instead a fixed table claims cells by their coordinates. Those cells never
// hold a session, so the Stevenskerk stays where it is however the park
// breathes, and the sessions flow around it.
//
// The Waal is not a cell. It runs along one cell edge, so no ground is lost to
// it and the lots on both banks are riverfront. Two crossings carry the road
// over it.
//
// Rows run south to north: row 0 and 1 are the old city, the river sits on the
// edge between row 1 and row 2, and everything north of it is Lent and the
// Waalsprong, which is also the direction the real city grew.

import { curveCell } from "./plots.ts";

export type Cell = { col: number; row: number };

// What stands on a claimed cell. `park`, `houses`, `shops` and `field` are the
// generic filler that keeps the city from being all factory; the rest are
// Nijmegen landmarks, one per cell.
export type Amenity =
  | "park"
  | "houses"
  | "shops"
  | "field"
  | "goffert"
  | "stevenskerk"
  | "valkhof"
  | "kronenburgerpark"
  | "waalkade"
  | "plein1944"
  | "station"
  | "linku";

// The river runs along the edge between this row and the one below it, so the
// water is centered on z = (WAAL_EDGE - 0.5) * PLOT_SIZE.
export const WAAL_EDGE = 2;

// Total width of the water, centered on that edge. The road it replaces is 10
// wide and a cell's yard leaves 10 of margin on each side, so 20 fills the road
// and both verges without reaching into a yard.
export const WAAL_WIDTH = 20;

// The two road crossings, named by the column boundary they sit on: the road at
// column boundary c runs at x = (c - 0.5) * PLOT_SIZE. De Oversteek lies west
// of the Waalbrug, as it does in the city.
export const BRIDGES: { col: number; kind: "oversteek" | "waalbrug" }[] = [
  { col: 1, kind: "oversteek" },
  { col: 3, kind: "waalbrug" },
];

// The Spoorbrug sits geographically between the two road bridges. It is kept
// deliberately separate from BRIDGES and crossingAt: the traffic graph may
// never mistake rails for another road across the Waal.
export const RAIL_BRIDGE = { col: 2 } as const;
export const RAIL_BRIDGE_SPAN = 36;

// East of the two named bridges the city gets plain crossings too, so it does
// not split in two once the park passes column 3: the first one at column 8,
// then every 5 columns after that (8, 13, 18, ...).
const PLAIN_CROSSING_START = 8;
const PLAIN_CROSSING_SPACING = 5;

// The gladiola arch of the Vierdaagse: not a building but a span over a road,
// on the southern edge of the city, where the walkers come in.
export const GLADIOLA = { col: 2, row: 0, side: "south" as const };

// Claimed cells, keyed by `col:row`. Landmarks sit in the first few dozen
// curve indexes so that even a quiet park shows a recognisable city; the
// generic filler thins out as the park grows (see FILLER_EVERY).
//
// These coordinates are a first pass, meant to be judged from a top-down
// screenshot and moved. Nothing outside this table depends on the exact
// numbers.
export const CLAIMED = new Map<string, Amenity>([
  ["0:0", "goffert"], // stadium and its green, at the south-west corner
  ["1:1", "stevenskerk"], // the heart, on the second cell the curve ever visits
  ["2:0", "station"], // west platform edge meets the rail corridor at column 2
  ["5:0", "kronenburgerpark"],
  ["7:0", "plein1944"],
  ["3:1", "valkhof"], // on the south bank, where the real one looks over the Waal
  ["3:0", "linku"], // Linku's rounded brick office on the St. Canisiussingel
  ["5:1", "waalkade"], // quay front, further east
  ["7:1", "field"],
  ["0:2", "houses"], // Lent, across the water
  ["3:3", "park"],
  ["6:2", "shops"],
]);

// Past the table the city keeps filling itself: every so many ranks of claimed
// ground, one more generic cell. Low enough that districts stay broken up,
// high enough that the park is still mostly factories.
export const FILLER_EVERY = 7;

// The generic filler used past the table, in the order it is handed out.
export const FILLER_CYCLE: Amenity[] = ["park", "houses", "shops", "field"];

const cellKey = (col: number, row: number) => `${col}:${row}`;

export function amenityAt(cell: Cell): Amenity | null {
  return CLAIMED.get(cellKey(cell.col, cell.row)) ?? null;
}

// What the plan puts on a curve index, cached. The filler counts the cells it
// has already passed, so an index can only be answered by walking the curve
// from 0; walking it again per lookup would be O(n) on every frame that adds a
// session. The walk is a pure function of the constants above, so the cache is
// only ever extended, never invalidated.
const plan: (Amenity | null)[] = [];
// Curve indexes with nothing on them, in order: index = free[rank].
const free: number[] = [];
let tableSkipped = 0; // cells passed that the table did not claim

function walkTo(index: number) {
  for (let i = plan.length; i <= index; i++) {
    const claimed = amenityAt(curveCell(i));
    if (claimed) {
      plan.push(claimed);
      continue;
    }
    tableSkipped++;
    if (tableSkipped % FILLER_EVERY === 0) {
      plan.push(FILLER_CYCLE[(tableSkipped / FILLER_EVERY - 1) % FILLER_CYCLE.length]);
    } else {
      plan.push(null);
      free.push(i);
    }
  }
}

// What stands on curve index `index`: a landmark from the table, a generic
// filler block, or nothing, in which case a session gets it.
export function claimAt(index: number): Amenity | null {
  walkTo(index);
  return plan[index];
}

// The curve index of the `rank`-th session. Sessions are ranked 0..n-1 by
// assignPlots; the plan's own cells are skipped, so a landmark never has to
// move aside for a session that just started.
//
// walkTo only fails to add a free cell if FILLER_EVERY is ever set to 1 (or
// less), which would claim every single cell. That is a configuration
// mistake, not something a real rank should hang on, so this gives up with a
// readable error once it has walked far more curve than any real rank needs.
const INDEX_FOR_RANK_SAFETY_MARGIN = 100_000;

export function indexForRank(rank: number): number {
  while (free.length <= rank) {
    walkTo(plan.length + 63);
    if (plan.length > rank + INDEX_FOR_RANK_SAFETY_MARGIN) {
      throw new Error(
        `indexForRank(${rank}): walked ${plan.length} curve indexes without finding enough free cells. Check FILLER_EVERY.`,
      );
    }
  }
  return free[rank];
}

// Every claimed cell the curve passes before the last session's cell: exactly
// what the scene has to build next to `rankCount` lots.
export function claimedUpTo(rankCount: number): { index: number; cell: Cell; amenity: Amenity }[] {
  if (rankCount <= 0) return [];
  const last = indexForRank(rankCount - 1);
  const claims: { index: number; cell: Cell; amenity: Amenity }[] = [];
  for (let index = 0; index <= last; index++) {
    const amenity = claimAt(index);
    if (amenity) claims.push({ index, cell: curveCell(index), amenity });
  }
  return claims;
}

// Whether two cells sit on the same side of the Waal. A worker never gets a
// destination across the water: nothing walks there, so a claim on the other
// bank would send it straight into the river.
function sameBank(a: Cell, b: Cell): boolean {
  return a.row < WAAL_EDGE === b.row < WAAL_EDGE;
}

// The claimed cell closest to `from` (euclidean, on cell coordinates) on the
// same bank of the Waal, or null when the city has nothing claimed yet on
// that bank. Ties go to the lower curve index: `claimedUpTo` already returns
// claims in index order, so keeping the first claim found at the best
// distance (never replacing on an equal distance) is enough, no separate
// tie-break needed.
export function nearestClaim(from: Cell, rankCount: number): Cell | null {
  const claims = claimedUpTo(rankCount).filter((claim) => sameBank(claim.cell, from));
  if (claims.length === 0) return null;
  let best = claims[0];
  let bestDist = cellDistance(from, best.cell);
  for (let i = 1; i < claims.length; i++) {
    const dist = cellDistance(from, claims[i].cell);
    if (dist < bestDist) {
      best = claims[i];
      bestDist = dist;
    }
  }
  return best.cell;
}

function cellDistance(a: Cell, b: Cell): number {
  return Math.hypot(a.col - b.col, a.row - b.row);
}

// True for the one horizontal cell edge the Waal runs along. Roads on that
// edge are water instead.
export function isWaterEdge(row: number): boolean {
  return row === WAAL_EDGE;
}

// What crosses the Waal at column boundary `col` (the road at x = (col - 0.5)
// * PLOT_SIZE): one of the two named bridges, a plain crossing further east,
// or nothing.
export function crossingAt(col: number): "oversteek" | "waalbrug" | "plain" | null {
  const named = BRIDGES.find((bridge) => bridge.col === col)?.kind;
  if (named) return named;
  return col >= PLAIN_CROSSING_START && (col - PLAIN_CROSSING_START) % PLAIN_CROSSING_SPACING === 0 ? "plain" : null;
}
