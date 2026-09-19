import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { RAIL_BRIDGE_SPAN, WAAL_EDGE } from "../city-plan.ts";
import { PLOT_SIZE } from "../plots.ts";
import {
  appendRailCorridor,
  RAIL_PEDESTRIAN_CLEARANCE,
  RAIL_X,
  railSafeX,
  railSegmentsForCells,
} from "../rail-corridor.ts";
import { StaticBuilder } from "../static-builder.ts";

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
