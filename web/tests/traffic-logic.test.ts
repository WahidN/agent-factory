import { describe, expect, it } from "vitest";
import { advance, gapAhead, laneLength, lotLanes, pickNext, roadGraph, spawnVehicle, stepVehicles, vehiclePose, type Vehicle } from "../traffic-logic.ts";

// Seeded random, so routes are the same on every run.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const car = (lane: string, s: number, roads = roadGraph([0])): Vehicle => ({ lane, next: pickNext(roads, lane, () => 0), s, speed: 10, length: 3.8 });

describe("roadGraph", () => {
  it("gives a lot two lanes on each of its 4 roads", () => {
    expect(roadGraph([0]).lanes.size).toBe(8);
  });

  it("adds a road shared by two lots once", () => {
    expect(roadGraph([0, 1]).lanes.size).toBe(14); // cells 0 and 1 share one road
  });

  it("includes every lot's own lanes", () => {
    const roads = roadGraph([0, 1, 2, 3]);
    for (const index of [0, 1, 2, 3]) for (const key of lotLanes(index)) expect(roads.lanes.has(key)).toBe(true);
  });
});

describe("vehiclePose", () => {
  it("keeps right, so the two directions of a road use different lanes", () => {
    const roads = roadGraph([0]);
    const east = vehiclePose(roads, car("0:0>1:0", 10));
    const west = vehiclePose(roads, car("1:0>0:0", 10));
    expect(east.z).toBeCloseTo(-30 + 2.5); // heading +x, right is +z
    expect(west.z).toBeCloseTo(-30 - 2.5);
  });

  it("drives the lot's own lanes next to the lot", () => {
    const roads = roadGraph([0]);
    for (const key of lotLanes(0)) {
      const { x, z } = vehiclePose(roads, car(key, 20));
      expect(Math.max(Math.abs(x), Math.abs(z))).toBeCloseTo(27.5);
    }
  });

  it("faces the direction of travel, also in turns", () => {
    const roads = roadGraph([0, 1, 2, 3]);
    let v = car("0:0>1:0", 0, roads);
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
    let v = car("0:0>1:0", 0, roads);
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
    let v = car("0:0>1:0", 0, roads);
    for (let i = 0; i < 3000; i++) {
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
    const roads = roadGraph([0, 1, 2, 3]);
    const random = seeded(5);
    let v = car("0:0>1:0", 0, roads);
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
    const vehicles = [car("0:0>1:0", 10), car("0:0>1:0", 15)];
    const [behind, ahead] = stepVehicles(roads, vehicles, 0.1, () => 0);
    expect(behind.s).toBe(10);
    expect(ahead.s).toBeCloseTo(16);
  });

  it("sees a car in the lane it turns into", () => {
    const roads = roadGraph([0]);
    const v = car("0:0>1:0", 0);
    const length = laneLength(roads, v);
    const vehicles = [{ ...v, s: length - 2 }, car(v.next, 3)];
    expect(gapAhead(roads, vehicles, 0)).toBeCloseTo(5 - 3.8);
  });

  it("drives at full speed with room ahead", () => {
    const roads = roadGraph([0]);
    const [a, b] = stepVehicles(roads, [car("0:0>1:0", 0), car("1:0>0:0", 0)], 0.1, () => 0);
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
