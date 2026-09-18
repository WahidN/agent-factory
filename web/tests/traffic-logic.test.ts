import { describe, expect, it } from "vitest";
import { BRIDGES, crossingAt, RAIL_BRIDGE, WAAL_EDGE } from "../city-plan.ts";
import { PLOT_SIZE, plotCell } from "../plots.ts";
import {
  advance,
  gapAhead,
  laneLength,
  lotLanes,
  pickNext,
  roadGraph,
  spawnVehicle,
  stepVehicles,
  vehiclePose,
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

// Two ranks that land side by side, away from the river.
const NEIGHBOURS = [8, 9];

const rowOf = (crossing: string) => Number(crossing.split(":")[1]);
const colOf = (crossing: string) => Number(crossing.split(":")[0]);

describe("roadGraph", () => {
  it("gives a lot two lanes on each of its 4 roads", () => {
    expect(roadGraph([0]).lanes.size).toBe(8);
  });

  it("adds a road shared by two lots once", () => {
    expect(plotCell(NEIGHBOURS[0]).row).toBe(plotCell(NEIGHBOURS[1]).row); // side by side
    expect(roadGraph(NEIGHBOURS).lanes.size).toBe(14); // they share one road
  });

  it("includes every lot's own lanes", () => {
    const roads = roadGraph([0, 1, 2, 3]);
    for (const rank of [0, 1, 2, 3]) {
      // A lot on the bank has fewer than four: the river took the rest.
      const own = lotLanes(rank).filter((key) => roads.lanes.has(key));
      expect(own.length).toBeGreaterThan(0);
    }
    for (const key of lotLanes(0)) expect(roads.lanes.has(key)).toBe(true);
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
    const exclusiveRoads = roadGraph(ranks, true);
    const railLanes = [...exclusiveRoads.lanes.values()].filter(
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

  it("turns a car around at a crossing the water left without a way on", () => {
    // Driving onto a bridge that has no bank road on the far side: the only
    // lane out of that crossing is the one back, so the car makes a U-turn
    // instead of the graph handing it a lane that does not exist.
    const deadEnd = roadGraph([1]); // a bank cell, its north side is river
    const onto = [...deadEnd.lanes.keys()].find((key) => rowOf(key.split(">")[1]) === WAAL_EDGE)!;
    const back = `${deadEnd.lanes.get(onto)!.to}>${deadEnd.lanes.get(onto)!.from}`;
    expect(pickNext(deadEnd, onto, () => 0.5)).toBe(back);
    expect(deadEnd.lanes.has(back)).toBe(true);
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
    for (const key of lotLanes(0)) {
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
      const lane = v.lane;
      v = advance(roads, v, 1, random);
      expect(roads.lanes.has(v.lane)).toBe(true);
      if (v.lane !== lane) {
        const from = roads.lanes.get(lane)!;
        const back = `${from.to}>${from.from}`;
        // Turning back is only allowed where the river left no other way on.
        if (v.lane === back) expect((roads.exits.get(from.to) ?? []).filter((key) => key !== back)).toEqual([]);
      }
    }
  });

  it("takes different turns over time", () => {
    const roads = roadGraph([0, 1, 2, 3, 4, 5, 6, 7]);
    const random = seeded(5);
    let v = car(EAST, 0, roads);
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
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
    const roads = roadGraph([0]);
    const v = car(EAST, 0);
    const length = laneLength(roads, v);
    const vehicles = [{ ...v, s: length - 2 }, car(v.next, 3)];
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
    const blocker = car(lotLanes(0)[0], 0);
    expect(spawnVehicle(roads, [blocker], 0, 10, 3.8, () => 0)).toBeNull();
  });
});
