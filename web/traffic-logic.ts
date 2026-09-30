// How cars and trucks drive the park roads. Pure, so it is easy to test.
//
// Roads run along cell edges and meet at crossings on cell corners. Every road
// has one lane per direction. Vehicles keep right, take a random turn at each
// crossing (never a U-turn), and slow down behind the vehicle ahead. Where the
// road ends they run out of lane and stop; the caller fades them out. They also
// hold before a closed level crossing.

import { crossingAt, isWaterEdge, RAIL_BRIDGE } from "./city-plan.ts";
import { plotCell, PLOT_SIZE } from "./plots.ts";

const LANE = 2.5; // lane center, measured from the road center (roads are 10 wide)
const TURN = 5; // a turn starts this far before the crossing center and ends this far after it
const STRAIGHT = PLOT_SIZE - TURN * 2;
const CURVE_STEPS = 8;
const MIN_GAP = 2; // stop when the space to the vehicle ahead gets this small
const FREE_GAP = 8; // full speed from this much space
const STOP_SETBACK = 7; // the ballast is 8.6 wide, so hold this far before the crossing center
const NO_BLOCKS: ReadonlySet<string> = new Set();

type Point = { x: number; z: number };
type Curve = [Point, Point, Point];

// One direction of one road edge. `x, z` is the crossing it starts at.
export type Lane = { from: string; to: string; x: number; z: number; dx: number; dz: number };

export type Roads = {
  lanes: Map<string, Lane>;
  exits: Map<string, string[]>; // crossing -> lanes leaving it
};

// `s` is the distance driven on `lane`, including the turn into `next`. A null
// `next` is a dead end: the lane is the last one, so `s` stops at its straight
// part and the vehicle waits there to be faded out.
export type Vehicle = { lane: string; next: string | null; s: number; speed: number; length: number };

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

// Every lane out of the crossing at the end of `laneKey`, minus the one
// straight back. A crossing on the river bank or on the edge of the built park
// can have none at all: the road it would continue into is water or was never
// built.
function onwardLanes(roads: Roads, laneKey: string): string[] {
  const lane = roads.lanes.get(laneKey)!;
  const back = `${lane.to}>${lane.from}`;
  return (roads.exits.get(lane.to) ?? []).filter((key) => key !== back);
}

// A random lane on from `laneKey`, or null at a dead end. Null rather than the
// lane back: a U-turn in the middle of an empty road reads as a bug, so the
// caller fades the vehicle out there and sends a new one somewhere else.
export function pickNext(roads: Roads, laneKey: string, random: () => number): string | null {
  const options = onwardLanes(roads, laneKey);
  return options.length ? options[Math.floor(random() * options.length)] : null;
}

// The lanes that run into the railway, mapped to the row of the level crossing
// they reach. `roadGraph` drops the north-south roads on the rail column, so
// every lane that arrives there crosses the track. The row, not its z, keeps
// this comparable with rail-corridor without trusting two floats to match.
export function railCrossingLanes(roads: Roads): Map<string, number> {
  const crossings = new Map<string, number>();
  for (const [key, lane] of roads.lanes) {
    const [col, row] = lane.to.split(":").map(Number);
    if (col === RAIL_BRIDGE.col) crossings.set(key, row);
  }
  return crossings;
}

// Where a vehicle this long has to halt on a lane running into a closed level
// crossing: its nose STOP_SETBACK before the center of the crossing.
const stopLine = (length: number) => PLOT_SIZE - TURN - STOP_SETBACK - length / 2;

// The curve through the crossing, from the end of `lane` to the start of
// `next`. Right is (-dz, dx) for a lane heading (dx, dz). Always a quadratic
// Bezier: the two lanes either run the same way or meet at a right angle, and
// a vehicle never turns back onto the lane it came from.
function turnCurve(roads: Roads, laneKey: string, nextKey: string): Curve {
  const a = roads.lanes.get(laneKey)!;
  const b = roads.lanes.get(nextKey)!; // starts at the crossing, so b.x, b.z is its center
  const start = { x: b.x - a.dx * TURN - a.dz * LANE, z: b.z - a.dz * TURN + a.dx * LANE };
  const end = { x: b.x + b.dx * TURN - b.dz * LANE, z: b.z + b.dz * TURN + b.dx * LANE };
  const straight = a.dx === b.dx && a.dz === b.dz;
  // Straight on, the control point is the midpoint; for a turn it is where the
  // two lane lines cross.
  const control = straight
    ? { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 }
    : { x: b.x - (a.dz + b.dz) * LANE, z: b.z + (a.dx + b.dx) * LANE };
  return [start, control, end];
}

// Closed-form Bernstein-basis evaluation of the quadratic curve turnCurve
// produces. gapAhead calls this once per vehicle pair every frame (via
// laneLength), so it stays allocation-free beyond the one Point it has to
// return.
function curvePoint([p0, p1, p2]: Curve, t: number): Point {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const ut2 = 2 * u * t;
  return { x: uu * p0.x + ut2 * p1.x + tt * p2.x, z: uu * p0.z + ut2 * p1.z + tt * p2.z };
}

// The tangent direction at `t`, in closed form (a Bezier's derivative is a
// Bezier one degree lower over the differences between its control points);
// only the direction matters here, so the usual scaling by the degree is
// skipped.
function curveTangent([p0, p1, p2]: Curve, t: number): Point {
  const u = 1 - t;
  return { x: u * (p1.x - p0.x) + t * (p2.x - p1.x), z: u * (p1.z - p0.z) + t * (p2.z - p1.z) };
}

function curveLength(curve: Curve): number {
  let length = 0;
  let previous = curve[0];
  for (let i = 1; i <= CURVE_STEPS; i++) {
    const point = curvePoint(curve, i / CURVE_STEPS);
    length += Math.hypot(point.x - previous.x, point.z - previous.z);
    previous = point;
  }
  return length;
}

// Length of the straight part of `lane` plus the turn into `next`. At a dead
// end there is no turn, so the straight part is all there is.
export function laneLength(roads: Roads, v: Vehicle): number {
  return v.next === null ? STRAIGHT : STRAIGHT + curveLength(turnCurve(roads, v.lane, v.next));
}

// True once a vehicle has driven the whole of a lane that has no way on. It
// stands still from then on, so the caller fades it out and sends a new one.
export function isFinished(v: Vehicle): boolean {
  return v.next === null && v.s >= STRAIGHT;
}

// Position and heading. `heading` is a rotation around y for a model facing +x.
export function vehiclePose(roads: Roads, v: Vehicle): { x: number; z: number; heading: number } {
  const lane = roads.lanes.get(v.lane)!;
  if (v.next === null || v.s < STRAIGHT) {
    const along = TURN + Math.min(v.s, STRAIGHT);
    return {
      x: lane.x + lane.dx * along - lane.dz * LANE,
      z: lane.z + lane.dz * along + lane.dx * LANE,
      heading: Math.atan2(-lane.dz, lane.dx),
    };
  }
  const curve = turnCurve(roads, v.lane, v.next);
  const t = Math.min(1, (v.s - STRAIGHT) / curveLength(curve));
  const tangent = curveTangent(curve, t);
  return { ...curvePoint(curve, t), heading: Math.atan2(-tangent.z, tangent.x) };
}

// Drives `distance` further, moving on to the next lane at the end of a turn.
// At a dead end it stops at the end of the lane instead.
export function advance(roads: Roads, v: Vehicle, distance: number, random: () => number): Vehicle {
  let next = { ...v, s: v.s + distance };
  let length = laneLength(roads, next);
  while (next.s >= length) {
    if (next.next === null) return { ...next, s: length };
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

// Moves every vehicle, slowing down or stopping behind the one ahead and
// before a closed level crossing. `blocked` holds the lanes whose crossing is
// shut. A vehicle already past the stop line is left alone, so it clears the
// track instead of halting on it.
export function stepVehicles(
  roads: Roads,
  vehicles: Vehicle[],
  dt: number,
  random: () => number,
  blocked: ReadonlySet<string> = NO_BLOCKS,
): Vehicle[] {
  return vehicles.map((v, i) => {
    const room = (gapAhead(roads, vehicles, i) - MIN_GAP) / (FREE_GAP - MIN_GAP);
    const stop = stopLine(v.length);
    const hold = blocked.has(v.lane) && v.s < stop ? (stop - v.s) / FREE_GAP : Infinity;
    const throttle = Math.min(1, Math.max(0, Math.min(room, hold)));
    return advance(roads, v, v.speed * throttle * dt, random);
  });
}

// A new vehicle on one of the lot's own lanes with room around it, or null
// when there is no room there right now. Lanes that lead on somewhere come
// first: a lot on the river bank would otherwise keep sending cars onto its
// one dead-end road, where they drive a single road length and fade again.
export function spawnVehicle(
  roads: Roads,
  vehicles: Vehicle[],
  index: number,
  speed: number,
  length: number,
  random: () => number,
): Vehicle | null {
  const own = lotLanes(index).filter((key) => roads.lanes.has(key));
  const onward = own.filter((key) => onwardLanes(roads, key).length > 0);
  const options = onward.length ? onward : own;
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
