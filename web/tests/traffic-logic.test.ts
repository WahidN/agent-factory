import { describe, expect, it } from "vitest";
import { BRIDGES, crossingAt, RAIL_BRIDGE, WAAL_EDGE } from "../city-plan.ts";
import { PLOT_SIZE, plotCell } from "../plots.ts";
import {
  advance,
  gapAhead,
  isFinished,
  laneLength,
  lotLanes,
  pickNext,
  railCrossingLanes,
  roadGraph,
  spawnVehicle,
  stepVehicles,
  vehiclePose,
  type Roads,
  type Vehicle,
} from "../traffic-logic.ts";

// Seeded random, so routes are the same on every run.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const car = (lane: string, s: number, roads = roadGraph([0])): Vehicle => ({
  lane,
  next: pickNext(roads, lane, () => 0),
  s,
  speed: 10,
  length: 3.8,
});

// Rank 0 sits on cell 1:0: cell 0:0 belongs to the Goffert, so the lanes around
// the first lot are named after that cell's corners, not after the origin.
const EAST = "1:0>2:0"; // its south road, heading +x
const WEST = "2:0>1:0";
const FIRST = plotCell(0);

// The lane running onto the river bank crossing that has no road on from it.
const deadEndLane = (roads: Roads) => [...roads.lanes.keys()].find((key) => rowOf(key.split(">")[1]) === WAAL_EDGE)!;

// A car that ran out of road stands still, so the park sends a new one. Tests
// that follow a route over thousands of steps do the same.
const respawn = (roads: Roads, v: Vehicle, random: () => number) =>
  spawnVehicle(roads, [], 0, v.speed, v.length, random)!;

// Two ranks that land side by side, away from the river.
const NEIGHBOURS = [2, 3];

const rowOf = (crossing: string) => Number(crossing.split(":")[1]);
const colOf = (crossing: string) => Number(crossing.split(":")[0]);

describe("roadGraph", () => {
  it("gives two lanes per road, none along the rail corridor", () => {
    // Rank 0's cell borders the rail corridor at RAIL_BRIDGE.col, so one of
    // its four sides carries only the train: 3 roads, 2 lanes each.
    expect(roadGraph([0]).lanes.size).toBe(6);
  });

  it("adds a road shared by two lots once", () => {
    expect(plotCell(NEIGHBOURS[0]).row).toBe(plotCell(NEIGHBOURS[1]).row); // side by side
    // One of the two also borders the rail corridor, so it is short a road too.
    expect(roadGraph(NEIGHBOURS).lanes.size).toBe(12);
  });

  it("includes every lot's own lanes", () => {
    const roads = roadGraph([0, 1, 2, 3]);
    for (const rank of [0, 1, 2, 3]) {
      // A lot on the bank or next to the rail corridor has fewer than four:
      // the river or the corridor took the rest.
      const own = lotLanes(rank).filter((key) => roads.lanes.has(key));
      expect(own.length).toBeGreaterThan(0);
    }
    const ownLanes = lotLanes(0).filter((key) => roads.lanes.has(key));
    expect(ownLanes.length).toBe(3);
  });
});

describe("the Waal in the road graph", () => {
  const ranks = Array.from({ length: 60 }, (_, rank) => rank);
  const roads = roadGraph(ranks);
  const bankCrossings = [...roads.lanes.values()].filter(
    (lane) => rowOf(lane.from) === WAAL_EDGE || rowOf(lane.to) === WAAL_EDGE,
  );

  it("has no road running along the water edge", () => {
    for (const lane of roads.lanes.values()) {
      expect(rowOf(lane.from) === WAAL_EDGE && rowOf(lane.to) === WAAL_EDGE).toBe(false);
    }
  });

  it("crosses the water on the bridge columns, and nowhere the plan does not name a crossing", () => {
    expect(bankCrossings.length).toBeGreaterThan(0);
    const columns = new Set(bankCrossings.map((lane) => colOf(lane.from)));
    for (const { col } of BRIDGES) expect(columns).toContain(col);
    for (const col of columns) expect(crossingAt(col)).not.toBeNull();
  });

  it("never treats the Spoorbrug landmark as a road crossing", () => {
    expect(crossingAt(RAIL_BRIDGE.col)).toBeNull();
    expect(bankCrossings.some((lane) => colOf(lane.from) === RAIL_BRIDGE.col)).toBe(false);
  });

  it("keeps the entire north-south rail corridor out of the road graph", () => {
    const railLanes = [...roads.lanes.values()].filter(
      (lane) => colOf(lane.from) === RAIL_BRIDGE.col && colOf(lane.to) === RAIL_BRIDGE.col,
    );
    expect(railLanes).toEqual([]);
  });

  it("never lets a car drive onto a lane that ends in the water", () => {
    const random = seeded(23);
    let v = car(EAST, 0, roads);
    for (let i = 0; i < 4000; i++) {
      v = advance(roads, v, 1, random);
      const lane = roads.lanes.get(v.lane)!;
      expect(lane).toBeDefined();
      expect(rowOf(lane.from) === WAAL_EDGE && rowOf(lane.to) === WAAL_EDGE).toBe(false);
      if (rowOf(lane.to) === WAAL_EDGE || rowOf(lane.from) === WAAL_EDGE) {
        expect(crossingAt(colOf(lane.from))).not.toBeNull();
      }
    }
  });

  // Further east the city gets plain crossings too (see crossingAt), so it
  // does not split in two once the park passes column 3.
  it("also carries traffic over every plain crossing, and nowhere else across the water", () => {
    const farRanks = Array.from({ length: 300 }, (_, rank) => rank);
    const farRoads = roadGraph(farRanks);
    const farCrossings = [...farRoads.lanes.values()].filter(
      (lane) => rowOf(lane.from) === WAAL_EDGE || rowOf(lane.to) === WAAL_EDGE,
    );
    const columns = new Set(farCrossings.map((lane) => colOf(lane.from)));
    expect(columns.size).toBeGreaterThan(BRIDGES.length);
    for (const col of columns) expect(crossingAt(col)).not.toBeNull();
    for (const col of [8, 13]) expect(columns).toContain(col);
  });

  it("reports no way on at a crossing the water left without one", () => {
    // Driving onto a bridge that has no bank road on the far side: the only
    // lane out of that crossing is the one back, and turning around there in
    // the middle of an empty road reads as a bug.
    const deadEnd = roadGraph([1]); // a bank cell, its north side is river
    const onto = deadEndLane(deadEnd);
    const back = `${deadEnd.lanes.get(onto)!.to}>${deadEnd.lanes.get(onto)!.from}`;
    expect(pickNext(deadEnd, onto, () => 0.5)).toBeNull();
    expect(deadEnd.lanes.has(back)).toBe(true); // the lane back exists, it is just not taken
  });

  it("parks a car at the end of a dead-end lane, facing the way it drove", () => {
    const deadEnd = roadGraph([1]);
    const onto = deadEndLane(deadEnd);
    const v: Vehicle = { lane: onto, next: null, s: 0, speed: 10, length: 3.8 };
    const length = laneLength(deadEnd, v);
    expect(isFinished(v)).toBe(false);

    const driven = advance(deadEnd, v, length + 50, () => 0);
    expect(driven.lane).toBe(onto);
    expect(driven.s).toBe(length);
    expect(isFinished(driven)).toBe(true);
    expect(vehiclePose(deadEnd, driven).heading).toBeCloseTo(vehiclePose(deadEnd, v).heading);
  });
});

describe("vehiclePose", () => {
  it("keeps right, so the two directions of a road use different lanes", () => {
    const roads = roadGraph([0]);
    const east = vehiclePose(roads, car(EAST, 10));
    const west = vehiclePose(roads, car(WEST, 10));
    expect(east.z).toBeCloseTo(-30 + 2.5); // heading +x, right is +z
    expect(west.z).toBeCloseTo(-30 - 2.5);
  });

  it("drives the lot's own lanes next to the lot", () => {
    const roads = roadGraph([0]);
    // One of the 4 sides borders the rail corridor and has no road at all.
    for (const key of lotLanes(0).filter((k) => roads.lanes.has(k))) {
      const { x, z } = vehiclePose(roads, car(key, 20));
      const offset = Math.max(Math.abs(x - FIRST.col * PLOT_SIZE), Math.abs(z - FIRST.row * PLOT_SIZE));
      expect(offset).toBeCloseTo(27.5);
    }
  });

  it("faces the direction of travel, also in turns", () => {
    const roads = roadGraph([0, 1, 2, 3]);
    let v = car(EAST, 0, roads);
    const random = seeded(3);
    for (let i = 0; i < 2000; i++) {
      if (isFinished(v)) v = respawn(roads, v, random);
      const a = vehiclePose(roads, v);
      v = advance(roads, v, 0.05, random);
      const b = vehiclePose(roads, v);
      const moved = Math.hypot(b.x - a.x, b.z - a.z);
      // A model facing +x rotated by heading points along (cos h, -sin h).
      expect(Math.cos(a.heading) * (b.x - a.x) - Math.sin(a.heading) * (b.z - a.z)).toBeGreaterThan(moved * 0.9);
    }
  });
});

describe("advance", () => {
  it("moves smoothly across lanes and turns", () => {
    const roads = roadGraph([0, 1, 2, 3, 4]);
    const random = seeded(7);
    let v = car(EAST, 0, roads);
    let previous = vehiclePose(roads, v);
    for (let i = 0; i < 5000; i++) {
      if (isFinished(v)) {
        v = respawn(roads, v, random);
        previous = vehiclePose(roads, v);
        continue;
      }
      v = advance(roads, v, 0.2, random);
      const point = vehiclePose(roads, v);
      expect(Math.hypot(point.x - previous.x, point.z - previous.z)).toBeLessThan(0.4);
      previous = point;
    }
  });

  it("only drives lanes that exist and never turns back", () => {
    const roads = roadGraph([0, 1, 2, 3, 4]);
    const random = seeded(11);
    let v = car(EAST, 0, roads);
    for (let i = 0; i < 3000; i++) {
      if (isFinished(v)) {
        v = respawn(roads, v, random);
        continue;
      }
      const lane = v.lane;
      v = advance(roads, v, 1, random);
      expect(roads.lanes.has(v.lane)).toBe(true);
      if (v.lane !== lane) {
        const from = roads.lanes.get(lane)!;
        expect(v.lane).not.toBe(`${from.to}>${from.from}`);
      }
    }
  });

  it("takes different turns over time", () => {
    const roads = roadGraph([0, 1, 2, 3, 4, 5, 6, 7]);
    const random = seeded(5);
    let v = car(EAST, 0, roads);
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      if (isFinished(v)) v = respawn(roads, v, random);
      v = advance(roads, v, 1, random);
      seen.add(v.lane);
    }
    expect(seen.size).toBeGreaterThan(12);
  });
});

describe("stepVehicles", () => {
  it("stops a car right behind another and lets the one ahead drive", () => {
    const roads = roadGraph([0]);
    const vehicles = [car(EAST, 10), car(EAST, 15)];
    const [behind, ahead] = stepVehicles(roads, vehicles, 0.1, () => 0);
    expect(behind.s).toBe(10);
    expect(ahead.s).toBeCloseTo(16);
  });

  it("sees a car in the lane it turns into", () => {
    // WEST, not EAST: east of rank 0 is the rail corridor, so that lane ends.
    const roads = roadGraph([0]);
    const v = car(WEST, 0);
    const length = laneLength(roads, v);
    const vehicles = [{ ...v, s: length - 2 }, car(v.next!, 3)];
    expect(gapAhead(roads, vehicles, 0)).toBeCloseTo(5 - 3.8);
  });

  it("drives at full speed with room ahead", () => {
    const roads = roadGraph([0]);
    const [a, b] = stepVehicles(roads, [car(EAST, 0), car(WEST, 0)], 0.1, () => 0);
    expect(a.s).toBeCloseTo(1);
    expect(b.s).toBeCloseTo(1);
  });
});

describe("spawnVehicle", () => {
  it("spawns on the lot's own lanes", () => {
    const roads = roadGraph([0, 1]);
    const random = seeded(2);
    for (let i = 0; i < 20; i++) {
      const v = spawnVehicle(roads, [], 1, 10, 3.8, random)!;
      expect(lotLanes(1)).toContain(v.lane);
    }
  });

  it("does not spawn on top of another vehicle", () => {
    const roads = roadGraph([0]);
    const blockers = lotLanes(0)
      .filter((key) => roads.lanes.has(key))
      .map((key) => car(key, 0, roads));
    expect(spawnVehicle(roads, blockers, 0, 10, 3.8, () => 0)).toBeNull();
  });

  it("prefers a lot lane that leads on somewhere", () => {
    // Rank 0 borders the rail corridor, so one of its four lanes is a dead end.
    const roads = roadGraph([0]);
    expect(lotLanes(0).filter((key) => roads.lanes.has(key) && pickNext(roads, key, () => 0) === null)).not.toEqual([]);
    const random = seeded(4);
    for (let i = 0; i < 20; i++) expect(spawnVehicle(roads, [], 0, 10, 3.8, random)!.next).not.toBeNull();
  });
});

describe("level crossings", () => {
  // Rank 0's east road runs into the rail column, so EAST is the lane over the
  // track. The stop line is 7 short of the crossing center, minus half a car.
  const STOP = PLOT_SIZE - 5 - 7 - 3.8 / 2;
  const shut = new Set([EAST]);

  it("names the lanes that run into the railway", () => {
    const roads = roadGraph([0]);
    const rail = railCrossingLanes(roads);
    expect(rail.get(EAST)).toBe(0); // the crossing on row boundary 0
    expect(rail.has(WEST)).toBe(false); // driving away from the track
  });

  it("stops a car clear of the track and lets it go once the barrier opens", () => {
    const roads = roadGraph([0]);
    let [v] = [car(EAST, 0)];
    for (let i = 0; i < 600; i++) [v] = stepVehicles(roads, [v], 1 / 30, () => 0, shut);
    expect(v.s).toBeCloseTo(STOP);

    for (let i = 0; i < 600; i++) [v] = stepVehicles(roads, [v], 1 / 30, () => 0);
    expect(v.s).toBe(laneLength(roads, v)); // drove on to the end of the road
  });

  it("lets a car that is already on the crossing clear the track", () => {
    const roads = roadGraph([0]);
    const onTrack = car(EAST, STOP + 2);
    const [moved] = stepVehicles(roads, [onTrack], 1 / 30, () => 0, shut);
    expect(moved.s).toBeGreaterThan(onTrack.s);
  });

  it("queues cars behind each other at a shut crossing", () => {
    const roads = roadGraph([0]);
    let vehicles = [car(EAST, 0), car(EAST, 6), car(EAST, 12)];
    for (let i = 0; i < 900; i++) vehicles = stepVehicles(roads, vehicles, 1 / 30, () => 0, shut);
    const queue = vehicles.map((v) => v.s).sort((a, b) => a - b);
    expect(queue[2]).toBeCloseTo(STOP);
    expect(queue[2] - queue[1]).toBeGreaterThan(3.8);
    expect(queue[1] - queue[0]).toBeGreaterThan(3.8);
  });
});
