import { RAIL_BRIDGE, WAAL_EDGE, WAAL_WIDTH, crossingAt } from "./city-plan.ts";
import { PLOT_SIZE } from "./plots.ts";
import { roadGraph, type Lane, type Roads } from "./traffic-logic.ts";

export const MAX_CYCLISTS = 40;
export const MAX_BUSES = 4;
export const MAX_TRAINS = 1;

const ROAD_EDGE_LENGTH = PLOT_SIZE;
const BIKE_LATERAL_OFFSET = 4.05;
const BUS_LATERAL_OFFSET = 2.5;
const TRAIN_HALF_TRAVEL = Math.max(5, WAAL_WIDTH / 2 - 1);

export type MobilityCity = {
  seed?: number;
  cyclists?: number;
  buses?: number;
  train?: boolean;
};

export type MobilityCounts = { cyclists: number; buses: number; trains: number };
export type MobilityPose = { x: number; y: number; z: number; heading: number };

type Fleet = {
  count: number;
  lane: Int32Array;
  distance: Float32Array;
  speed: Float32Array;
  variant: Uint8Array;
};

const makeFleet = (max: number): Fleet => ({
  count: 0,
  lane: new Int32Array(max),
  distance: new Float32Array(max),
  speed: new Float32Array(max),
  variant: new Uint8Array(max),
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
 * Allocation-free runtime state for cyclists, buses and the train. Network
 * arrays are rebuilt only when setRoads is called; tick mutates typed arrays.
 */
export class UrbanMobilitySimulation {
  private city: Required<MobilityCity> = { seed: 1944, cyclists: 24, buses: 2, train: true };
  private roads: Roads = roadGraph([]);
  private lanes: Lane[] = [];
  private nextLane = new Int32Array(0);
  private cyclists = makeFleet(MAX_CYCLISTS);
  private buses = makeFleet(MAX_BUSES);
  private trainDistance = 0;
  private trainDirection = 1;
  private readonly countSnapshot: MobilityCounts = { cyclists: 0, buses: 0, trains: 0 };

  setCity(city: MobilityCity = {}): void {
    this.city = {
      seed: city.seed ?? 1944,
      cyclists: boundedCount(city.cyclists, 24, MAX_CYCLISTS),
      buses: boundedCount(city.buses, 2, MAX_BUSES),
      train: city.train ?? true,
    };
    this.resetFleets();
  }

  setRoads(indexes: readonly number[]): void {
    this.roads = roadGraph([...indexes]);
    this.lanes = [...this.roads.lanes.values()].sort((a, b) => laneKey(a).localeCompare(laneKey(b)));
    const laneIndex = new Map<string, number>();
    this.lanes.forEach((lane, index) => {
      laneIndex.set(laneKey(lane), index);
    });
    this.nextLane = new Int32Array(this.lanes.length * 4);
    for (let i = 0; i < this.lanes.length; i++) {
      const lane = this.lanes[i];
      const back = `${lane.to}>${lane.from}`;
      const exits = [...(this.roads.exits.get(lane.to) ?? [])].filter((key) => key !== back).sort();
      const choices = exits.length ? exits : [back];
      for (let variant = 0; variant < 4; variant++) {
        const choice = choices[mix(this.city.seed + i * 17 + variant * 101) % choices.length];
        this.nextLane[i * 4 + variant] = laneIndex.get(choice) ?? i;
      }
    }
    this.resetFleets();
  }

  tick(dtSeconds: number): void {
    const dt = Math.max(0, Math.min(0.1, dtSeconds));
    this.advanceFleet(this.cyclists, dt);
    this.advanceFleet(this.buses, dt);
    if (!this.city.train) return;
    this.trainDistance += this.trainDirection * dt * 12;
    if (this.trainDistance > TRAIN_HALF_TRAVEL) {
      this.trainDistance = TRAIN_HALF_TRAVEL - (this.trainDistance - TRAIN_HALF_TRAVEL);
      this.trainDirection = -1;
    } else if (this.trainDistance < -TRAIN_HALF_TRAVEL) {
      this.trainDistance = -TRAIN_HALF_TRAVEL + (-TRAIN_HALF_TRAVEL - this.trainDistance);
      this.trainDirection = 1;
    }
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

  trainPose(out: MobilityPose): MobilityPose {
    out.x = (RAIL_BRIDGE.col - 0.5) * PLOT_SIZE;
    out.y = 0.78;
    out.z = (WAAL_EDGE - 0.5) * PLOT_SIZE + this.trainDistance;
    out.heading = this.trainDirection > 0 ? -Math.PI / 2 : Math.PI / 2;
    return out;
  }

  laneForCyclist(index: number): Lane | undefined {
    return this.lanes[this.cyclists.lane[index]];
  }

  laneForBus(index: number): Lane | undefined {
    return this.lanes[this.buses.lane[index]];
  }

  trainUsesRoadCrossing(): boolean {
    return crossingAt(RAIL_BRIDGE.col) !== null;
  }

  private resetFleets(): void {
    const available = this.lanes.length;
    this.cyclists.count = available ? Math.min(this.city.cyclists, MAX_CYCLISTS) : 0;
    this.buses.count = available ? Math.min(this.city.buses, MAX_BUSES) : 0;
    this.countSnapshot.cyclists = this.cyclists.count;
    this.countSnapshot.buses = this.buses.count;
    this.countSnapshot.trains = this.city.train ? 1 : 0;
    this.seedFleet(this.cyclists, this.city.seed + 31, 3.7, 1.1);
    this.seedFleet(this.buses, this.city.seed + 73, 8.2, 0.7);
    this.trainDistance = 0;
    this.trainDirection = 1;
  }

  private seedFleet(fleet: Fleet, seed: number, baseSpeed: number, variation: number): void {
    if (!this.lanes.length) return;
    for (let i = 0; i < fleet.count; i++) {
      const h = mix(seed + i * 977);
      fleet.lane[i] = h % this.lanes.length;
      fleet.distance[i] = ((h >>> 8) / 0x00ffffff) * ROAD_EDGE_LENGTH;
      fleet.speed[i] = baseSpeed + ((h >>> 24) / 255) * variation;
      fleet.variant[i] = (h >>> 5) & 3;
    }
  }

  private advanceFleet(fleet: Fleet, dt: number): void {
    for (let i = 0; i < fleet.count; i++) {
      let distance = fleet.distance[i] + fleet.speed[i] * dt;
      let lane = fleet.lane[i];
      while (distance >= ROAD_EDGE_LENGTH) {
        distance -= ROAD_EDGE_LENGTH;
        lane = this.nextLane[lane * 4 + fleet.variant[i]];
      }
      fleet.distance[i] = distance;
      fleet.lane[i] = lane;
    }
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
