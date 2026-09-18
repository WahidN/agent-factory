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
  it("runs from scene edge to scene edge and leaves exactly the bridge span open", () => {
    const segments = railSegmentsForCells([
      { col: 0, row: 0 },
      { col: 5, row: 4 },
    ]);
    const waterZ = (WAAL_EDGE - 0.5) * PLOT_SIZE;
    expect(segments).toEqual([
      { from: -PLOT_SIZE / 2, to: waterZ - RAIL_BRIDGE_SPAN / 2 },
      { from: waterZ + RAIL_BRIDGE_SPAN / 2, to: 4.5 * PLOT_SIZE },
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
      { col: 0, row: 0 },
      { col: 0, row: 3 },
    ]);
    const box = new THREE.Box3().setFromObject(builder.build());
    expect(box.min.z).toBeCloseTo(-PLOT_SIZE / 2);
    expect(box.max.z).toBeCloseTo(3.5 * PLOT_SIZE);
    expect(box.max.y).toBeGreaterThan(5);
    expect(box.min.x).toBeLessThan(RAIL_X - 4);
    expect(box.max.x).toBeGreaterThan(RAIL_X + 4);
  });
});
