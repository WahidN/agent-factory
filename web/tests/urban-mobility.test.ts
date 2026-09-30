import { describe, expect, it } from "vitest";
import { RAIL_BRIDGE, WAAL_EDGE, crossingAt } from "../city-plan.ts";
import { PLOT_SIZE } from "../plots.ts";
import { MAX_BUSES, MAX_CYCLISTS, UrbanMobilitySimulation, type MobilityPose } from "../urban-mobility-logic.ts";
import { UrbanMobility } from "../urban-mobility.ts";

const RANKS = Array.from({ length: 80 }, (_, rank) => rank);
const rowOf = (crossing: string) => Number(crossing.split(":")[1]);
const colOf = (crossing: string) => Number(crossing.split(":")[0]);

describe("UrbanMobilitySimulation", () => {
  it("keeps cyclist and bus routes on roads and crosses the Waal only at road bridges", () => {
    const mobility = new UrbanMobilitySimulation();
    mobility.setCity({ cyclists: MAX_CYCLISTS, buses: MAX_BUSES, seed: 1944 });
    mobility.setRoads(RANKS);

    for (let frame = 0; frame < 12_000; frame++) {
      mobility.tick(1 / 30);
      const counts = mobility.counts();
      for (let i = 0; i < counts.cyclists; i++) {
        const lane = mobility.laneForCyclist(i)!;
        expect(lane).toBeDefined();
        if (rowOf(lane.from) === WAAL_EDGE || rowOf(lane.to) === WAAL_EDGE) {
          expect(crossingAt(colOf(lane.from))).not.toBeNull();
        }
      }
      for (let i = 0; i < counts.buses; i++) {
        const lane = mobility.laneForBus(i)!;
        expect(lane).toBeDefined();
        if (rowOf(lane.from) === WAAL_EDGE || rowOf(lane.to) === WAAL_EDGE) {
          expect(crossingAt(colOf(lane.from))).not.toBeNull();
        }
      }
    }
  });

  it("caps every fleet at its fixed instance capacity", () => {
    const mobility = new UrbanMobilitySimulation();
    mobility.setRoads(RANKS);
    mobility.setCity({ cyclists: 10_000, buses: 10_000, train: true });
    // The first train rolls on once the service starts, so it takes a tick.
    for (let i = 0; i < 3; i++) mobility.tick(1 / 30);
    expect(mobility.counts()).toEqual({ cyclists: MAX_CYCLISTS, buses: MAX_BUSES, trains: 1 });
  });

  it("keeps a cyclist's lane and distance when setRoads is called again with the same roads", () => {
    const mobility = new UrbanMobilitySimulation();
    mobility.setCity({ cyclists: MAX_CYCLISTS, buses: MAX_BUSES, seed: 1944 });
    mobility.setRoads(RANKS);
    mobility.tick(1 / 30); // advance off the seeded starting distance
    const pose: MobilityPose = { x: 0, y: 0, z: 0, heading: 0 };
    const before = Array.from({ length: MAX_CYCLISTS }, (_, i) => ({ ...mobility.cyclistPose(i, pose) }));
    const lanesBefore = Array.from({ length: MAX_CYCLISTS }, (_, i) => mobility.laneForCyclist(i));

    mobility.setRoads(RANKS);

    for (let i = 0; i < MAX_CYCLISTS; i++) {
      expect(mobility.laneForCyclist(i)).toEqual(lanesBefore[i]);
      const after = mobility.cyclistPose(i, pose);
      expect(after.x).toBeCloseTo(before[i].x);
      expect(after.z).toBeCloseTo(before[i].z);
    }
  });

  it("keeps the train's position clamped to the new range instead of resetting it, when setRoads is called again", () => {
    const mobility = new UrbanMobilitySimulation();
    mobility.setRoads(RANKS);
    for (let i = 0; i < 300; i++) mobility.tick(1 / 30); // move it away from the start of its range
    const pose: MobilityPose = { x: 0, y: 0, z: 0, heading: 0 };
    const before = { ...mobility.trainPose(pose) };

    mobility.setRoads(RANKS);

    const after = mobility.trainPose(pose);
    expect(after.z).toBeCloseTo(before.z);
  });

  it("reuses its public count snapshot while ticking", () => {
    const mobility = new UrbanMobilitySimulation();
    mobility.setRoads(RANKS);
    const counts = mobility.counts();
    for (let i = 0; i < 600; i++) mobility.tick(1 / 60);
    expect(mobility.counts()).toBe(counts);
  });

  it("keeps the train on the separate rail bridge and never exposes it as a road crossing", () => {
    const mobility = new UrbanMobilitySimulation();
    mobility.setRoads(RANKS);
    const pose: MobilityPose = { x: 0, y: 0, z: 0, heading: 0 };
    const railX = (RAIL_BRIDGE.col - 0.5) * PLOT_SIZE;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 4_000; i++) {
      mobility.tick(1 / 30);
      mobility.trainPose(pose);
      expect(pose.x).toBe(railX);
      minZ = Math.min(minZ, pose.z);
      maxZ = Math.max(maxZ, pose.z);
    }
    expect(minZ).toBeLessThan((WAAL_EDGE - 0.5) * PLOT_SIZE - 20);
    expect(maxZ).toBeGreaterThan((WAAL_EDGE - 0.5) * PLOT_SIZE + 20);
    expect(crossingAt(RAIL_BRIDGE.col)).toBeNull();
  });
});

describe("edge fade", () => {
  it("fades a cyclist out where the road ends and rides a new one in elsewhere", () => {
    const mobility = new UrbanMobilitySimulation();
    mobility.setCity({ cyclists: 8, buses: 0, train: false, seed: 7 });
    // One lot only: the rail corridor and the river leave every route here
    // ending within a few roads.
    mobility.setRoads([0]);
    const fading = Array.from({ length: 8 }, () => false);
    const landings: string[][] = Array.from({ length: 8 }, () => []);

    for (let frame = 0; frame < 6_000; frame++) {
      mobility.tick(1 / 30);
      expect(mobility.counts().cyclists).toBe(8);
      for (let i = 0; i < 8; i++) {
        const presence = mobility.cyclistPresence(i);
        expect(presence).toBeGreaterThanOrEqual(0);
        expect(presence).toBeLessThanOrEqual(1);
        if (presence < 0.05) fading[i] = true;
        else if (presence > 0.9 && fading[i]) {
          fading[i] = false;
          const lane = mobility.laneForCyclist(i)!;
          landings[i].push(`${lane.from}>${lane.to}`);
        }
      }
    }

    const returned = landings.filter((list) => list.length >= 2);
    expect(returned.length).toBeGreaterThan(0);
    // The generation counter is what makes a replacement land somewhere else.
    for (const list of returned) expect(new Set(list).size).toBeGreaterThan(1);
  });
});

describe("train service", () => {
  it("runs one way, then leaves the track empty for at least 35 seconds", () => {
    const mobility = new UrbanMobilitySimulation();
    mobility.setCity({ cyclists: 0, buses: 0, train: true, seed: 1944 });
    mobility.setRoads(RANKS);
    const pose: MobilityPose = { x: 0, y: 0, z: 0, heading: 0 };
    const gaps: number[] = [];
    const headings = new Set<number>();
    let empty = 0;
    let seenTrain = false;
    let previousZ: number | null = null;
    let way = 0;

    for (let frame = 0; frame < 30_000; frame++) {
      mobility.tick(1 / 30);
      if (mobility.counts().trains === 0) {
        if (seenTrain) empty += 1 / 30; // the frames before the first train are not a gap
        previousZ = null;
        way = 0;
        continue;
      }
      seenTrain = true;
      if (empty > 0) {
        gaps.push(empty);
        empty = 0;
      }
      const z = mobility.trainPose(pose).z;
      headings.add(pose.heading);
      const step = previousZ === null ? 0 : Math.sign(z - previousZ);
      if (step !== 0) {
        if (way === 0) way = step;
        expect(step).toBe(way); // never reverses inside a run
      }
      previousZ = z;
    }

    expect(gaps.length).toBeGreaterThan(1);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(35);
    expect(headings.size).toBe(2); // trains come from both ends
  });

  it("keeps the rails empty and the booms up when the city has no train", () => {
    const mobility = new UrbanMobilitySimulation();
    mobility.setCity({ cyclists: 0, buses: 0, train: false });
    mobility.setRoads(RANKS);
    for (let frame = 0; frame < 3_000; frame++) {
      mobility.tick(1 / 30);
      expect(mobility.counts().trains).toBe(0);
      for (let i = 0; i < mobility.crossingCount(); i++) expect(mobility.boomAt(i)).toBe(0);
      expect(mobility.shutCrossings().size).toBe(0);
    }
  });
});

describe("level crossings", () => {
  it("shuts a crossing before the train arrives and opens it once it has passed", () => {
    const mobility = new UrbanMobilitySimulation();
    mobility.setCity({ cyclists: 0, buses: 0, train: true, seed: 1944 });
    mobility.setRoads(RANKS);
    expect(mobility.crossingCount()).toBeGreaterThan(1);
    const pose: MobilityPose = { x: 0, y: 0, z: 0, heading: 0 };
    const warned = new Set<number>();
    const opened = new Set<number>();
    const shutAhead = new Map<number, number>();

    for (let frame = 0; frame < 12_000; frame++) {
      mobility.tick(1 / 30);
      const running = mobility.counts().trains > 0;
      const trainZ = mobility.trainPose(pose).z;
      for (let i = 0; i < mobility.crossingCount(); i++) {
        const distance = Math.abs(trainZ - mobility.crossingZAt(i));
        const boom = mobility.boomAt(i);
        // Down and locked before the train is anywhere near the road.
        if (running && boom === 1 && distance > 20) shutAhead.set(i, distance);
        if (running && distance < 10) {
          expect(boom).toBe(1);
          warned.add(i);
        }
        if (warned.has(i) && boom === 0) opened.add(i);
      }
    }

    expect(warned.size).toBeGreaterThan(1);
    expect(opened.size).toBe(warned.size);
    for (const i of warned) expect(shutAhead.get(i)).toBeGreaterThan(20);
  });

  it("holds cyclists clear of the track and spread out while the barrier is shut", () => {
    const mobility = new UrbanMobilitySimulation();
    mobility.setCity({ cyclists: MAX_CYCLISTS, buses: MAX_BUSES, train: true, seed: 1944 });
    // Four lots: a short network, so several riders queue at the one crossing.
    mobility.setRoads([0, 1, 2, 3]);
    const pose: MobilityPose = { x: 0, y: 0, z: 0, heading: 0 };
    const railX = (RAIL_BRIDGE.col - 0.5) * PLOT_SIZE;
    const previousX = new Float64Array(MAX_CYCLISTS).fill(Number.NaN);
    let waited = 0;
    let spreadOut = 0;

    for (let frame = 0; frame < 12_000; frame++) {
      mobility.tick(1 / 30);
      const shut = mobility.shutCrossings();
      const queues = new Map<string, Set<number>>();
      for (let i = 0; i < mobility.counts().cyclists; i++) {
        const lane = mobility.laneForCyclist(i)!;
        const { x } = mobility.cyclistPose(i, pose);
        const before = previousX[i];
        previousX[i] = x;
        if (!shut.has(rowOf(lane.to)) || colOf(lane.to) !== RAIL_BRIDGE.col) continue;
        if (x !== before || mobility.cyclistPresence(i) < 1) continue; // rolling on, or fading out
        expect(Math.abs(x - railX)).toBeGreaterThan(4.3); // waiting, so clear of the ballast
        waited++;
        const key = `${lane.from}>${lane.to}`;
        queues.set(key, (queues.get(key) ?? new Set()).add(Math.round(x * 10)));
      }
      // Riders held at one crossing stand at their own spot, not all on one.
      for (const spots of queues.values()) if (spots.size > 2) spreadOut++;
    }

    expect(waited).toBeGreaterThan(0);
    expect(spreadOut).toBeGreaterThan(0);
  });

  it("lets nobody onto the track while a barrier is down", () => {
    const mobility = new UrbanMobilitySimulation();
    mobility.setCity({ cyclists: MAX_CYCLISTS, buses: MAX_BUSES, train: true, seed: 7 });
    mobility.setRoads(Array.from({ length: 24 }, (_, rank) => rank));
    const pose: MobilityPose = { x: 0, y: 0, z: 0, heading: 0 };
    const railX = (RAIL_BRIDGE.col - 0.5) * PLOT_SIZE;
    let closed = 0;

    for (let frame = 0; frame < 36_000; frame++) {
      mobility.tick(1 / 60);
      const counts = mobility.counts();
      for (let i = 0; i < mobility.crossingCount(); i++) {
        if (mobility.boomAt(i) < 1) continue;
        closed++;
        const z = mobility.crossingZAt(i);
        const onTrack = (p: MobilityPose) => Math.abs(p.x - railX) < 5 && Math.abs(p.z - z) < 6;
        for (let c = 0; c < counts.cyclists; c++) {
          if (mobility.cyclistPresence(c) > 0.5) expect(onTrack(mobility.cyclistPose(c, pose))).toBe(false);
        }
        for (let b = 0; b < counts.buses; b++) {
          if (mobility.busPresence(b) > 0.5) expect(onTrack(mobility.busPose(b, pose))).toBe(false);
        }
      }
    }

    expect(closed).toBeGreaterThan(0);
  });
});

describe("UrbanMobility", () => {
  it("uses five stable instanced meshes while everything moves", () => {
    const mobility = new UrbanMobility();
    mobility.setRoads(RANKS);
    const children = [...mobility.group.children];
    // Cyclists, buses and the train, plus the crossing posts and booms.
    const meshes = children.flatMap((child) => ("isInstancedMesh" in child ? [child] : child.children));
    expect(meshes).toHaveLength(5);
    for (let i = 0; i < 600; i++) mobility.tick(1 / 60);
    expect(mobility.group.children).toEqual(children);
    expect(meshes.every((child) => "isInstancedMesh" in child)).toBe(true);
  });
});
