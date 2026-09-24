import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PLOT_SIZE } from "../plots.ts";
import { StaticBuilder } from "../static-builder.ts";
import { appendTerrainRelief, terrainFeaturesForCells } from "../terrain.ts";

const cells = [
  { col: 1, row: 1 },
  { col: 3, row: 1 },
  { col: 1, row: 2 },
  { col: 3, row: 2 },
];
const river = { minCol: 1, maxCol: 3 };

describe("static Nijmegen relief", () => {
  it("is deterministic and adds the stuwwal cues", () => {
    const first = terrainFeaturesForCells(cells, river);
    expect(terrainFeaturesForCells(cells, river)).toEqual(first);
    expect(first.filter(({ kind }) => kind === "stuwwal-terrace")).toHaveLength(2);
  });

  it("centers the terraces on the Valkhof's claimed cell", () => {
    for (const { x } of terrainFeaturesForCells(cells, river)) expect(x).toBe(3 * PLOT_SIZE);
  });

  it("adds nothing while the Valkhof is not part of the city", () => {
    expect(terrainFeaturesForCells([{ col: 1, row: 1 }], river)).toEqual([]);
  });

  it("stays within the active riverfront cells and remains low", () => {
    const features = terrainFeaturesForCells(cells, river);
    const west = (river.minCol - 0.5) * PLOT_SIZE;
    const east = (river.maxCol + 0.5) * PLOT_SIZE;
    for (const feature of features) {
      expect(feature.x - feature.width / 2).toBeGreaterThanOrEqual(west);
      expect(feature.x + feature.width / 2).toBeLessThanOrEqual(east);
      expect(feature.y + feature.height / 2).toBeLessThanOrEqual(1);
    }
  });

  it("returns no terrain before the city reaches the Waal", () => {
    expect(terrainFeaturesForCells([{ col: 0, row: 0 }], null)).toEqual([]);
  });

  it("batches every relief piece into one static mesh", () => {
    const builder = new StaticBuilder();
    appendTerrainRelief(builder, cells, river);
    const group = builder.build();
    expect(group.children).toHaveLength(1);
    expect(group.children[0]).toBeInstanceOf(THREE.Mesh);
  });
});
