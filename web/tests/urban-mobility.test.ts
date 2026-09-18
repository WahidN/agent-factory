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
    expect(mobility.counts()).toEqual({ cyclists: MAX_CYCLISTS, buses: MAX_BUSES, trains: 1 });
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
    for (let i = 0; i < 2_000; i++) {
      mobility.tick(1 / 30);
      mobility.trainPose(pose);
      expect(pose.x).toBe(railX);
    }
    expect(crossingAt(RAIL_BRIDGE.col)).toBeNull();
    expect(mobility.trainUsesRoadCrossing()).toBe(false);
  });
});

describe("UrbanMobility", () => {
  it("uses three stable instanced meshes while everything moves", () => {
    const mobility = new UrbanMobility();
    mobility.setRoads(RANKS);
    const meshes = [...mobility.group.children];
    expect(mobility.drawCallBudget).toBe(3);
    expect(meshes).toHaveLength(3);
    for (let i = 0; i < 600; i++) mobility.tick(1 / 60);
    expect(mobility.group.children).toEqual(meshes);
    expect(mobility.group.children.every((child) => "isInstancedMesh" in child)).toBe(true);
  });
});
