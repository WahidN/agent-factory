import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { RAIL_BRIDGE_SPAN, WAAL_EDGE } from "../city-plan.ts";
import { PLOT_SIZE, ROAD_WIDTH } from "../plots.ts";
import {
  appendRailCorridor,
  RAIL_PEDESTRIAN_CLEARANCE,
  RAIL_X,
  railSafeX,
  railSegmentsForCells,
} from "../rail-corridor.ts";
import { StaticBuilder, type Vec3 } from "../static-builder.ts";

describe("rail corridor", () => {
  it("runs only beside adjacent city cells and leaves exactly the bridge span open", () => {
    const segments = railSegmentsForCells([
      { col: 1, row: 0 },
      { col: 2, row: 1 },
      { col: 2, row: 2 },
      { col: 1, row: 3 },
      { col: 8, row: 8 },
    ]);
    const waterZ = (WAAL_EDGE - 0.5) * PLOT_SIZE;
    expect(segments).toEqual([
      { from: -PLOT_SIZE / 2, to: waterZ - RAIL_BRIDGE_SPAN / 2 },
      { from: waterZ + RAIL_BRIDGE_SPAN / 2, to: 3.5 * PLOT_SIZE },
    ]);
  });

  it("does not connect separated rail-side districts through empty meadow", () => {
    expect(
      railSegmentsForCells([
        { col: 1, row: 0 },
        { col: 2, row: 3 },
      ]),
    ).toEqual([
      { from: -PLOT_SIZE / 2, to: PLOT_SIZE / 2 },
      { from: 2.5 * PLOT_SIZE, to: 3.5 * PLOT_SIZE },
    ]);
  });

  it("keeps people outside the fenced right-of-way", () => {
    expect(railSafeX(RAIL_X)).toBe(RAIL_X + RAIL_PEDESTRIAN_CLEARANCE);
    expect(railSafeX(RAIL_X - 1)).toBe(RAIL_X - RAIL_PEDESTRIAN_CLEARANCE);
    expect(railSafeX(RAIL_X + 20)).toBe(RAIL_X + 20);
  });

  it("leaves a level crossing open wherever an east-west road meets the track", () => {
    type Piece = { x: [number, number]; y: [number, number]; z: [number, number] };
    class Recorder extends StaticBuilder {
      pieces: Piece[] = [];
      override box(material: THREE.Material, position: Vec3, scale: Vec3, rotation: Vec3 = [0, 0, 0]) {
        const span = (i: number): [number, number] => [position[i] - scale[i] / 2, position[i] + scale[i] / 2];
        this.pieces.push({ x: span(0), y: span(1), z: span(2) });
        super.box(material, position, scale, rotation);
      }
    }
    const builder = new Recorder();
    appendRailCorridor(builder, [
      { col: 1, row: 0 },
      { col: 2, row: 1 },
      { col: 2, row: 2 },
      { col: 1, row: 3 },
    ]);

    // Row boundaries 0..4 carry a road, except the one the Waal runs along.
    for (const row of [0, 1, 3, 4]) {
      const roadZ = (row - 0.5) * PLOT_SIZE;
      const blocking = builder.pieces.filter(
        ({ x, y, z }) =>
          z[0] < roadZ + ROAD_WIDTH / 2 &&
          z[1] > roadZ - ROAD_WIDTH / 2 &&
          y[0] < 4 && // overhead wire and its arms are clear of traffic
          x[1] - x[0] > 0.2, // the two rails themselves stay in the road
      );
      expect(blocking, `road at row boundary ${row}`).toEqual([]);
    }
  });

  it("builds visible ballast, rails, fencing and catenary", () => {
    const builder = new StaticBuilder();
    appendRailCorridor(builder, [
      { col: 1, row: 0 },
      { col: 2, row: 1 },
      { col: 2, row: 2 },
      { col: 1, row: 3 },
    ]);
    const box = new THREE.Box3().setFromObject(builder.build());
    expect(box.min.z).toBeCloseTo(-PLOT_SIZE / 2);
    expect(box.max.z).toBeCloseTo(3.5 * PLOT_SIZE);
    expect(box.max.y).toBeGreaterThan(5);
    expect(box.min.x).toBeLessThan(RAIL_X - 4);
    expect(box.max.x).toBeGreaterThan(RAIL_X + 4);
  });
});
