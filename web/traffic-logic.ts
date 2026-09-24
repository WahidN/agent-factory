// How cars and trucks drive the park roads. Pure, so it is easy to test.
//
// Roads run along cell edges and meet at crossings on cell corners. Every road
// has one lane per direction. Vehicles keep right, take a random turn at each
// crossing (never a U-turn), and slow down behind the vehicle ahead.

import { crossingAt, isWaterEdge, RAIL_BRIDGE } from "./city-plan.ts";
import { plotCell, PLOT_SIZE } from "./plots.ts";

const LANE = 2.5; // lane center, measured from the road center (roads are 10 wide)
const TURN = 5; // a turn starts this far before the crossing center and ends this far after it
const STRAIGHT = PLOT_SIZE - TURN * 2;
const CURVE_STEPS = 8;
const MIN_GAP = 2; // stop when the space to the vehicle ahead gets this small
const FREE_GAP = 8; // full speed from this much space

type Point = { x: number; z: number };

// One direction of one road edge. `x, z` is the crossing it starts at.
export type Lane = { from: string; to: string; x: number; z: number; dx: number; dz: number };

export type Roads = {
  lanes: Map<string, Lane>;
  exits: Map<string, string[]>; // crossing -> lanes leaving it
};

// `s` is the distance driven on `lane`, including the turn into `next`.
export type Vehicle = { lane: string; next: string; s: number; speed: number; length: number };

const crossing = (col: number, row: number) => `${col}:${row}`;

// The cell's 4 corners, clockwise as seen from above.
function corners(rank: number): [number, number][] {
  const { col, row } = plotCell(rank);
  return [
    [col, row],
    [col + 1, row],
    [col + 1, row + 1],
    [col, row + 1],
  ];
}

// Whether the Waal is in the way of the road between two neighbouring
// crossings. A road along the water edge is the river itself, so it is gone.
// A road across that edge ends up on a bridge deck, which only exists on the
// bridge columns; everywhere else it would run straight into the water.
function overWater([fc, fr]: [number, number], [, tr]: [number, number]): boolean {
  if (fr === tr) return isWaterEdge(fr);
  return (isWaterEdge(fr) || isWaterEdge(tr)) && crossingAt(fc) === null;
}

// Both lanes of the 4 roads around every used cell. Shared roads are added
// once. The rail corridor column carries only the train, never a road.
export function roadGraph(ranks: number[]): Roads {
  const lanes = new Map<string, Lane>();
  const exits = new Map<string, string[]>();
  const add = ([fc, fr]: [number, number], [tc, tr]: [number, number]) => {
    if (fr !== tr && fc === RAIL_BRIDGE.col) return;
    if (overWater([fc, fr], [tc, tr])) return;
    const from = crossing(fc, fr);
    const key = `${from}>${crossing(tc, tr)}`;
    if (lanes.has(key)) return;
    lanes.set(key, {
      from,
      to: crossing(tc, tr),
      x: (fc - 0.5) * PLOT_SIZE,
      z: (fr - 0.5) * PLOT_SIZE,
      dx: tc - fc,
      dz: tr - fr,
    });
    exits.set(from, [...(exits.get(from) ?? []), key]);
  };
  for (const rank of ranks) {
    const c = corners(rank);
    c.forEach((corner, i) => {
      add(corner, c[(i + 1) % 4]);
      add(c[(i + 1) % 4], corner);
    });
  }
  return { lanes, exits };
}

// The lanes right next to a lot: driving clockwise keeps the lot on the right.
// A lot on the river bank has fewer than four, so callers filter on the lanes
// that the graph actually holds.
export function lotLanes(rank: number): string[] {
  const c = corners(rank);
  return c.map((corner, i) => `${crossing(...corner)}>${crossing(...c[(i + 1) % 4])}`);
}

// A random lane out of the crossing at the end of `laneKey`, never straight
// back. A crossing on the river bank can have no way on at all: the road it
// would continue into is water. The vehicle then turns around, which is what a
// driver at a dead end does, and `back` is always a real lane because roads are
// added in both directions at once.
export function pickNext(roads: Roads, laneKey: string, random: () => number): string {
  const lane = roads.lanes.get(laneKey)!;
  const back = `${lane.to}>${lane.from}`;
  const options = (roads.exits.get(lane.to) ?? []).filter((key) => key !== back);
  return options.length ? options[Math.floor(random() * options.length)] : back;
}

// The curve through the crossing, from the end of `lane` to the start of `next`.
// Right is (-dz, dx) for a lane heading (dx, dz). Most turns are a quadratic
// Bezier (3 points); a dead-end U-turn is a cubic (4 points), since no single
// control point can match the lane heading at both ends when they run
// anti-parallel, offset sideways by a lane.
function turnCurve(roads: Roads, v: Vehicle): Point[] {
  const a = roads.lanes.get(v.lane)!;
  const b = roads.lanes.get(v.next)!; // starts at the crossing, so b.x, b.z is its center
  const start = { x: b.x - a.dx * TURN - a.dz * LANE, z: b.z - a.dz * TURN + a.dx * LANE };
  const end = { x: b.x + b.dx * TURN - b.dz * LANE, z: b.z + b.dz * TURN + b.dx * LANE };
  const straight = a.dx === b.dx && a.dz === b.dz;
  if (straight) {
    const control = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
    return [start, control, end];
  }
  const reversal = a.dx === -b.dx && a.dz === -b.dz;
  if (reversal) {
    // The lane back is parallel to `a`, not crossing it, so loop out along
    // a's own heading and curve back in along b's: c1 sits ahead of start
    // along a's direction, c2 sits back from end against b's direction (so
    // moving from c2 to end still points along b), keeping the tangent
    // continuous at both ends instead of overshooting the crossing.
    const c1 = { x: start.x + a.dx * TURN, z: start.z + a.dz * TURN };
    const c2 = { x: end.x - b.dx * TURN, z: end.z - b.dz * TURN };
    return [start, c1, c2, end];
  }
  // For a turn, the control point is where the two lane lines cross.
  const control = { x: b.x - (a.dz + b.dz) * LANE, z: b.z + (a.dx + b.dx) * LANE };
  return [start, control, end];
}

// Closed-form Bernstein-basis evaluation for the quadratic (3-point) and
// cubic (4-point, dead-end U-turn) curves turnCurve produces. gapAhead calls
// this once per vehicle pair every frame (via laneLength), so it stays
// allocation-free beyond the one Point it has to return; the old generic
// De Casteljau reduction built a fresh scratch array per recursion level.
function curvePoint(curve: Point[], t: number): Point {
  const u = 1 - t;
  if (curve.length === 3) {
    const [p0, p1, p2] = curve;
    const uu = u * u;
    const tt = t * t;
    const ut2 = 2 * u * t;
    return { x: uu * p0.x + ut2 * p1.x + tt * p2.x, z: uu * p0.z + ut2 * p1.z + tt * p2.z };
  }
  const [p0, p1, p2, p3] = curve;
  const uu = u * u;
  const uuu = uu * u;
  const tt = t * t;
  const ttt = tt * t;
  const uut3 = 3 * uu * t;
  const utt3 = 3 * u * tt;
  return {
    x: uuu * p0.x + uut3 * p1.x + utt3 * p2.x + ttt * p3.x,
    z: uuu * p0.z + uut3 * p1.z + utt3 * p2.z + ttt * p3.z,
  };
}

// The tangent direction at `t`, in closed form (a Bezier's derivative is a
// Bezier one degree lower over the differences between its control points);
// only the direction matters here, so the usual scaling by the degree is
// skipped.
function curveTangent(curve: Point[], t: number): Point {
  const u = 1 - t;
  if (curve.length === 3) {
    const [p0, p1, p2] = curve;
    return { x: u * (p1.x - p0.x) + t * (p2.x - p1.x), z: u * (p1.z - p0.z) + t * (p2.z - p1.z) };
  }
  const [p0, p1, p2, p3] = curve;
  const uu = u * u;
  const tt = t * t;
  const ut2 = 2 * u * t;
  return {
    x: uu * (p1.x - p0.x) + ut2 * (p2.x - p1.x) + tt * (p3.x - p2.x),
    z: uu * (p1.z - p0.z) + ut2 * (p2.z - p1.z) + tt * (p3.z - p2.z),
  };
}

function curveLength(curve: Point[]): number {
  let length = 0;
  let previous = curve[0];
  for (let i = 1; i <= CURVE_STEPS; i++) {
    const point = curvePoint(curve, i / CURVE_STEPS);
    length += Math.hypot(point.x - previous.x, point.z - previous.z);
    previous = point;
  }
  return length;
}

// Length of the straight part of `lane` plus the turn into `next`.
export function laneLength(roads: Roads, v: Vehicle): number {
  return STRAIGHT + curveLength(turnCurve(roads, v));
}

// Position and heading. `heading` is a rotation around y for a model facing +x.
export function vehiclePose(roads: Roads, v: Vehicle): { x: number; z: number; heading: number } {
  const lane = roads.lanes.get(v.lane)!;
  if (v.s < STRAIGHT) {
    const along = TURN + v.s;
    return {
      x: lane.x + lane.dx * along - lane.dz * LANE,
      z: lane.z + lane.dz * along + lane.dx * LANE,
      heading: Math.atan2(-lane.dz, lane.dx),
    };
  }
  const curve = turnCurve(roads, v);
  const t = Math.min(1, (v.s - STRAIGHT) / curveLength(curve));
  const tangent = curveTangent(curve, t);
  return { ...curvePoint(curve, t), heading: Math.atan2(-tangent.z, tangent.x) };
}

// Drives `distance` further, moving on to the next lane at the end of a turn.
export function advance(roads: Roads, v: Vehicle, distance: number, random: () => number): Vehicle {
  let next = { ...v, s: v.s + distance };
  let length = laneLength(roads, next);
  while (next.s >= length) {
    next = { ...next, lane: next.next, next: pickNext(roads, next.next, random), s: next.s - length };
    length = laneLength(roads, next);
  }
  return next;
}

// Free space in front of vehicle `i`, bumper to bumper, to the nearest vehicle
// in its lane or in the lane it turns into.
export function gapAhead(roads: Roads, vehicles: Vehicle[], i: number): number {
  const v = vehicles[i];
  let gap = Infinity;
  vehicles.forEach((other, j) => {
    if (j === i) return;
    let distance: number;
    if (other.lane === v.lane && (other.s > v.s || (other.s === v.s && j < i))) distance = other.s - v.s;
    else if (other.lane === v.next) distance = laneLength(roads, v) - v.s + other.s;
    else return;
    gap = Math.min(gap, distance - (v.length + other.length) / 2);
  });
  return gap;
}

// Moves every vehicle, slowing down or stopping behind the one ahead.
export function stepVehicles(roads: Roads, vehicles: Vehicle[], dt: number, random: () => number): Vehicle[] {
  return vehicles.map((v, i) => {
    const room = (gapAhead(roads, vehicles, i) - MIN_GAP) / (FREE_GAP - MIN_GAP);
    return advance(roads, v, v.speed * Math.min(1, Math.max(0, room)) * dt, random);
  });
}

// A new vehicle on one of the lot's own lanes with room around it, or null
// when there is no room there right now.
export function spawnVehicle(
  roads: Roads,
  vehicles: Vehicle[],
  index: number,
  speed: number,
  length: number,
  random: () => number,
): Vehicle | null {
  const options = lotLanes(index).filter((key) => roads.lanes.has(key));
  for (let attempt = 0; attempt < 4 && options.length; attempt++) {
    const lane = options[Math.floor(random() * options.length)];
    const v = { lane, next: pickNext(roads, lane, random), s: random() * STRAIGHT, speed, length };
    const p = vehiclePose(roads, v);
    const clear = vehicles.every((other) => {
      const q = vehiclePose(roads, other);
      return Math.hypot(p.x - q.x, p.z - q.z) > (length + other.length) / 2 + FREE_GAP;
    });
    if (clear) return v;
  }
  return null;
}
