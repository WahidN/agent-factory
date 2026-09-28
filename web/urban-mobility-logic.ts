import { RAIL_BRIDGE, WAAL_EDGE, claimedUpTo } from "./city-plan.ts";
import { plotCell, PLOT_SIZE } from "./plots.ts";
import { crossingZ, levelCrossingRows, railSegmentsForCells } from "./rail-corridor.ts";
import { railCrossingLanes, roadGraph, type Lane, type Roads } from "./traffic-logic.ts";

export const MAX_CYCLISTS = 40;
export const MAX_BUSES = 4;
export const MAX_TRAINS = 1;
export const MAX_CROSSINGS = 24;

const ROAD_EDGE_LENGTH = PLOT_SIZE;
const BIKE_LATERAL_OFFSET = 4.05;
const BUS_LATERAL_OFFSET = 2.5;
const TRAIN_HALF_LENGTH = 10.5;
const WAAL_Z = (WAAL_EDGE - 0.5) * PLOT_SIZE;

const FADE_SECONDS = 0.6; // how long a cyclist or bus takes to fade in or out

const TRAIN_SPEED = 12;
const TRAIN_FADE = 14; // metres of track the train fades in and out over, about a second
const TRAIN_GAP_MIN = 35; // seconds of empty track between two trains
const TRAIN_GAP_SPAN = 25;

const CROSSING_APPROACH = 60; // shut the barrier from this far ahead of the train
const CROSSING_CLEAR = 25; // open it once the tail is this far past
const BOOM_SPEED = 1; // the arm swings between up and down in about a second
const BOOM_SHUT = 0.02; // road traffic waits from the moment the arm starts to move
const ROAD_STOP = PLOT_SIZE - 7; // hold this far short of the center of the crossing
const WAIT_SPREAD = 2.5; // waiting riders stand this far apart

export type MobilityCity = {
  seed?: number;
  cyclists?: number;
  buses?: number;
  train?: boolean;
};

export type MobilityCounts = { cyclists: number; buses: number; trains: number };
export type MobilityPose = { x: number; y: number; z: number; heading: number };

// `presence` scales the drawn instance, so a member fades in when it is seeded
// and out once `leaving` is set. `generation` counts how often it has been
// reseeded and goes into the hash, so a replacement lands on another lane
// instead of looping over the same two roads.
type Fleet = {
  count: number;
  lane: Int32Array;
  distance: Float32Array;
  speed: Float32Array;
  variant: Uint8Array;
  presence: Float32Array;
  leaving: Uint8Array;
  generation: Uint32Array;
};

const makeFleet = (max: number): Fleet => ({
  count: 0,
  lane: new Int32Array(max),
  distance: new Float32Array(max),
  speed: new Float32Array(max),
  variant: new Uint8Array(max),
  presence: new Float32Array(max),
  leaving: new Uint8Array(max),
  generation: new Uint32Array(max),
});

function boundedCount(value: number | undefined, fallback: number, maximum: number): number {
  return Math.max(0, Math.min(maximum, Math.floor(value ?? fallback)));
}

function mix(seed: number): number {
  let x = seed | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

function laneKey(lane: Lane): string {
  return `${lane.from}>${lane.to}`;
}

/**
 * Allocation-free runtime state for cyclists, buses, the train and the level
 * crossings. Network arrays are rebuilt only when setRoads is called; tick
 * mutates typed arrays.
 */
export class UrbanMobilitySimulation {
  private city: Required<MobilityCity> = { seed: 1944, cyclists: 24, buses: 2, train: true };
  private roads: Roads = roadGraph([]);
  private lanes: Lane[] = [];
  private laneIndex = new Map<string, number>();
  private nextLane = new Int32Array(0); // -1 where the road ends
  private laneCrossing = new Int32Array(0); // lane -> level crossing it runs into, or -1
  private cyclists = makeFleet(MAX_CYCLISTS);
  private buses = makeFleet(MAX_BUSES);
  private trainZ = WAAL_Z;
  private trainMinZ = WAAL_Z;
  private trainMaxZ = WAAL_Z;
  private trainDirection = 1;
  // The service: one train drives the track, then the rails stay empty for a
  // while. It starts waiting with no time on the clock, so the first train
  // comes straight away instead of after a full gap.
  private running = false;
  private gapLeft = 0;
  private runs = 0;
  private trainShown = 0;
  private crossingRows: number[] = [];
  private crossingZs = new Float32Array(0);
  private booms = new Float32Array(0); // 0 is up, 1 is down
  private readonly shutRows = new Set<number>();
  private readonly countSnapshot: MobilityCounts = { cyclists: 0, buses: 0, trains: 0 };

  setCity(city: MobilityCity = {}): void {
    this.city = {
      seed: city.seed ?? 1944,
      cyclists: boundedCount(city.cyclists, 24, MAX_CYCLISTS),
      buses: boundedCount(city.buses, 2, MAX_BUSES),
      train: city.train ?? true,
    };
    this.resizeFleets();
  }

  setRoads(indexes: readonly number[]): void {
    const oldLanes = this.lanes;
    this.roads = roadGraph([...indexes]);
    this.lanes = [...this.roads.lanes.values()].sort((a, b) => laneKey(a).localeCompare(laneKey(b)));
    this.laneIndex = new Map();
    this.lanes.forEach((lane, index) => {
      this.laneIndex.set(laneKey(lane), index);
    });
    this.nextLane = new Int32Array(this.lanes.length * 4);
    for (let i = 0; i < this.lanes.length; i++) {
      const lane = this.lanes[i];
      const back = `${lane.to}>${lane.from}`;
      const exits = [...(this.roads.exits.get(lane.to) ?? [])].filter((key) => key !== back).sort();
      for (let variant = 0; variant < 4; variant++) {
        // No way on means the road ends here. The rider leaves the city rather
        // than turning around on an empty road.
        const choice = exits.length ? exits[mix(this.city.seed + i * 17 + variant * 101) % exits.length] : undefined;
        this.nextLane[i * 4 + variant] = choice === undefined ? -1 : (this.laneIndex.get(choice) ?? -1);
      }
    }
    const railCells = [...indexes.map(plotCell), ...claimedUpTo(indexes.length).map(({ cell }) => cell)];
    const railSegments = railSegmentsForCells(railCells);
    this.trainMinZ = (railSegments[0]?.from ?? WAAL_Z) + TRAIN_HALF_LENGTH;
    this.trainMaxZ = (railSegments.at(-1)?.to ?? WAAL_Z) - TRAIN_HALF_LENGTH;
    if (this.trainMaxZ < this.trainMinZ) this.trainMaxZ = this.trainMinZ;
    // Keep a running train where it was, just clamped to the (possibly
    // narrower) new range, instead of snapping it back to the start.
    this.trainZ = Math.min(Math.max(this.trainZ, this.trainMinZ), this.trainMaxZ);
    this.setCrossings(levelCrossingRows(railCells));
    this.remapFleet(this.cyclists, oldLanes, this.city.seed + 31, 3.7, 1.1);
    this.remapFleet(this.buses, oldLanes, this.city.seed + 73, 8.2, 0.7);
    this.resizeFleets();
  }

  // dt is already clamped to a sane frame size by the caller (scene.ts).
  tick(dt: number): void {
    this.advanceFleet(this.cyclists, dt, this.city.seed + 31, 3.7, 1.1, ROAD_STOP);
    this.advanceFleet(this.buses, dt, this.city.seed + 73, 8.2, 0.7, ROAD_STOP - 6);
    this.advanceTrain(dt);
    this.advanceBooms(dt);
  }

  counts(): MobilityCounts {
    return this.countSnapshot;
  }

  cyclistPose(index: number, out: MobilityPose): MobilityPose {
    return this.roadPose(this.cyclists, index, BIKE_LATERAL_OFFSET, 0.06, out);
  }

  busPose(index: number, out: MobilityPose): MobilityPose {
    return this.roadPose(this.buses, index, BUS_LATERAL_OFFSET, 0.08, out);
  }

  cyclistPresence(index: number): number {
    return this.cyclists.presence[index];
  }

  busPresence(index: number): number {
    return this.buses.presence[index];
  }

  trainPose(out: MobilityPose): MobilityPose {
    out.x = (RAIL_BRIDGE.col - 0.5) * PLOT_SIZE;
    out.y = 0.78;
    out.z = this.trainZ;
    out.heading = this.trainDirection > 0 ? -Math.PI / 2 : Math.PI / 2;
    return out;
  }

  trainPresence(): number {
    return this.trainShown;
  }

  crossingCount(): number {
    return this.crossingRows.length;
  }

  /** Where the barriers of crossing `index` stand, along the track. */
  crossingZAt(index: number): number {
    return this.crossingZs[index];
  }

  /** 0 with the booms up, 1 with them down, moving between the two. */
  boomAt(index: number): number {
    return this.booms[index];
  }

  /** The rows whose barriers are shut, so road traffic has to wait there. */
  shutCrossings(): ReadonlySet<number> {
    return this.shutRows;
  }

  laneForCyclist(index: number): Lane | undefined {
    return this.lanes[this.cyclists.lane[index]];
  }

  laneForBus(index: number): Lane | undefined {
    return this.lanes[this.buses.lane[index]];
  }

  // Keeps the boom progress of a crossing that is still there, so a park that
  // grows while a train runs does not throw its barriers back open.
  private setCrossings(rows: readonly number[]): void {
    const held = new Map(this.crossingRows.map((row, i) => [row, this.booms[i]]));
    this.crossingRows = rows.slice(0, MAX_CROSSINGS);
    this.crossingZs = new Float32Array(this.crossingRows.map(crossingZ));
    this.booms = new Float32Array(this.crossingRows.map((row) => held.get(row) ?? 0));
    const crossingOfRow = new Map(this.crossingRows.map((row, i) => [row, i]));
    const railLanes = railCrossingLanes(this.roads);
    this.laneCrossing = new Int32Array(this.lanes.length).fill(-1);
    this.lanes.forEach((lane, i) => {
      const row = railLanes.get(laneKey(lane));
      this.laneCrossing[i] = row === undefined ? -1 : (crossingOfRow.get(row) ?? -1);
    });
  }

  private resizeFleets(): void {
    const available = this.lanes.length;
    this.resizeFleet(
      this.cyclists,
      available ? Math.min(this.city.cyclists, MAX_CYCLISTS) : 0,
      this.city.seed + 31,
      3.7,
      1.1,
    );
    this.resizeFleet(this.buses, available ? Math.min(this.city.buses, MAX_BUSES) : 0, this.city.seed + 73, 8.2, 0.7);
    this.countSnapshot.cyclists = this.cyclists.count;
    this.countSnapshot.buses = this.buses.count;
  }

  // Keeps every member the fleet already had and only seeds the ones a
  // growing count adds; a shrinking count just drops the extras.
  private resizeFleet(fleet: Fleet, wanted: number, seed: number, baseSpeed: number, variation: number): void {
    for (let i = fleet.count; i < wanted; i++) this.seedOne(fleet, i, seed, baseSpeed, variation);
    fleet.count = wanted;
  }

  // Existing members whose lane is gone from the new road graph get reseeded
  // in place; the rest keep the lane (remapped to its new index), distance,
  // speed and variant they already had.
  private remapFleet(fleet: Fleet, oldLanes: Lane[], seed: number, baseSpeed: number, variation: number): void {
    if (!this.lanes.length) return;
    for (let i = 0; i < fleet.count; i++) {
      const oldLane = oldLanes[fleet.lane[i]];
      const newIndex = oldLane ? this.laneIndex.get(laneKey(oldLane)) : undefined;
      if (newIndex === undefined) this.seedOne(fleet, i, seed, baseSpeed, variation);
      else fleet.lane[i] = newIndex;
    }
  }

  private seedOne(fleet: Fleet, i: number, seed: number, baseSpeed: number, variation: number): void {
    if (!this.lanes.length) return;
    const h = mix(seed + i * 977 + fleet.generation[i] * 7919);
    fleet.lane[i] = h % this.lanes.length;
    fleet.distance[i] = ((h >>> 8) / 0x00ffffff) * ROAD_EDGE_LENGTH;
    fleet.speed[i] = baseSpeed + ((h >>> 24) / 255) * variation;
    fleet.variant[i] = (h >>> 5) & 3;
    fleet.presence[i] = 0;
    fleet.leaving[i] = 0;
  }

  private advanceFleet(
    fleet: Fleet,
    dt: number,
    seed: number,
    baseSpeed: number,
    variation: number,
    stopBase: number,
  ): void {
    const fade = dt / FADE_SECONDS;
    for (let i = 0; i < fleet.count; i++) {
      if (fleet.leaving[i]) {
        fleet.presence[i] -= fade;
        // Faded out at the edge of the city, so a fresh one rides in elsewhere.
        if (fleet.presence[i] <= 0) {
          fleet.generation[i]++;
          this.seedOne(fleet, i, seed, baseSpeed, variation);
        }
        continue;
      }
      fleet.presence[i] = Math.min(1, fleet.presence[i] + fade);
      const lane = fleet.lane[i];
      // Waiting riders line up over the last stretch instead of on one spot.
      const stop = stopBase - (i % 5) * WAIT_SPREAD;
      const crossing = this.laneCrossing[lane];
      const shut = crossing >= 0 && this.booms[crossing] > BOOM_SHUT;
      // A rider already past the stop line clears the track rather than
      // standing on it. The test is `<=`, so one that has reached the line
      // stays on it instead of rolling over the track on the next frame.
      if (shut && fleet.distance[i] <= stop) {
        fleet.distance[i] = Math.min(fleet.distance[i] + fleet.speed[i] * dt, stop);
        continue;
      }
      let distance = fleet.distance[i] + fleet.speed[i] * dt;
      let onLane = lane;
      while (distance >= ROAD_EDGE_LENGTH) {
        const next = this.nextLane[onLane * 4 + fleet.variant[i]];
        if (next < 0) {
          fleet.leaving[i] = 1;
          // A road that ends at the railway ends at the stop line, so the
          // rider fades out beside the track instead of between the rails.
          distance = this.laneCrossing[onLane] >= 0 ? stop : ROAD_EDGE_LENGTH;
          break;
        }
        distance -= ROAD_EDGE_LENGTH;
        onLane = next;
      }
      fleet.distance[i] = distance;
      fleet.lane[i] = onLane;
    }
  }

  // One train drives the whole track one way, fades out past the end, and the
  // rails then stay empty for TRAIN_GAP_MIN seconds or more.
  private advanceTrain(dt: number): void {
    if (!this.city.train || this.trainMaxZ <= this.trainMinZ) {
      this.running = false;
      this.trainShown = 0;
      this.countSnapshot.trains = 0;
      return;
    }
    if (!this.running) {
      this.gapLeft -= dt;
      if (this.gapLeft <= 0) this.startRun();
      this.countSnapshot.trains = 0;
      return;
    }
    this.trainZ += this.trainDirection * TRAIN_SPEED * dt;
    const track = this.trainMaxZ - this.trainMinZ;
    const driven = this.trainDirection > 0 ? this.trainZ - this.trainMinZ : this.trainMaxZ - this.trainZ;
    // Fade over the first and last stretch of the run, and over a third of a
    // short track, so a train never pops in at full size.
    const fade = Math.min(TRAIN_FADE, track / 3);
    this.trainShown = Math.max(0, Math.min(1, Math.min(driven, track - driven) / fade));
    this.countSnapshot.trains = this.trainShown > 0 ? 1 : 0;
    if (driven >= track) this.startGap();
  }

  private startRun(): void {
    const h = mix(this.city.seed + this.runs * 7919);
    this.runs++;
    this.trainDirection = h & 1 ? 1 : -1;
    this.trainZ = this.trainDirection > 0 ? this.trainMinZ : this.trainMaxZ;
    this.trainShown = 0;
    this.running = true;
  }

  private startGap(): void {
    const h = mix(this.city.seed + this.runs * 104729);
    this.running = false;
    this.trainShown = 0;
    this.countSnapshot.trains = 0;
    this.gapLeft = TRAIN_GAP_MIN + ((h >>> 8) / 0x00ffffff) * TRAIN_GAP_SPAN;
  }

  private advanceBooms(dt: number): void {
    this.shutRows.clear();
    const step = dt * BOOM_SPEED;
    for (let i = 0; i < this.crossingRows.length; i++) {
      const down = this.trainNears(this.crossingZs[i]);
      this.booms[i] = down ? Math.min(1, this.booms[i] + step) : Math.max(0, this.booms[i] - step);
      if (this.booms[i] > BOOM_SHUT) this.shutRows.add(this.crossingRows[i]);
    }
  }

  // Shut from CROSSING_APPROACH ahead of the train until its tail is
  // CROSSING_CLEAR past. `ahead` is measured along the way the train drives.
  private trainNears(z: number): boolean {
    if (!this.running) return false;
    const ahead = (z - this.trainZ) * this.trainDirection;
    return ahead <= CROSSING_APPROACH && ahead >= -(TRAIN_HALF_LENGTH + CROSSING_CLEAR);
  }

  private roadPose(fleet: Fleet, index: number, lateral: number, y: number, out: MobilityPose): MobilityPose {
    const lane = this.lanes[fleet.lane[index]];
    if (!lane) {
      out.x = out.z = out.heading = 0;
      out.y = -100;
      return out;
    }
    const distance = fleet.distance[index];
    out.x = lane.x + lane.dx * distance - lane.dz * lateral;
    out.z = lane.z + lane.dz * distance + lane.dx * lateral;
    out.y = y;
    out.heading = Math.atan2(-lane.dz, lane.dx);
    return out;
  }
}
