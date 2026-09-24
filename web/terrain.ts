// Cheap, static relief cues for Nijmegen. Roads and lots remain on y = 0;
// the stuwwal terraces stay inside the Valkhof's own cell, so navigation and
// traffic paths need no height awareness. The Waal fills the whole gap between
// the yards of both banks, so there is no free bank strip for a dike.

import type { Cell } from "./city-plan.ts";
import { amenityAt, WAAL_EDGE, WAAL_WIDTH } from "./city-plan.ts";
import { standard } from "./palette.ts";
import { PLOT_SIZE } from "./plots.ts";
import type { StaticBuilder } from "./static-builder.ts";

export type TerrainFeature = {
  kind: "stuwwal-terrace";
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
};

export type TerrainRiverSpan = { minCol: number; maxCol: number } | null;

const terraceStone = standard("#918b7d", { roughness: 1 });
const terraceGrass = standard("#577d47", { roughness: 1 });

const riverZ = (WAAL_EDGE - 0.5) * PLOT_SIZE;
const southBankZ = riverZ - WAAL_WIDTH / 2;

export function terrainFeaturesForCells(cells: Cell[], river: TerrainRiverSpan): TerrainFeature[] {
  if (!river || cells.length === 0) return [];

  // The Valkhof/stuwwal is already a real raised landmark. Two long, thin
  // terraces connect that hill visually to the riverbank without lifting its
  // cell, nearby roads, or any other building.
  const valkhof = cells.find((cell) => amenityAt(cell) === "valkhof");
  if (!valkhof) return [];
  const x = valkhof.col * PLOT_SIZE;
  return [
    { kind: "stuwwal-terrace", x, y: 0.38, z: southBankZ - 3.2, width: 35, height: 0.76, depth: 1.2 },
    { kind: "stuwwal-terrace", x, y: 0.2, z: southBankZ - 6.2, width: 29, height: 0.4, depth: 1.5 },
  ];
}

export function appendTerrainRelief(builder: StaticBuilder, cells: Cell[], river: TerrainRiverSpan) {
  for (const feature of terrainFeaturesForCells(cells, river)) {
    builder.box(
      feature.height > 0.5 ? terraceStone : terraceGrass,
      [feature.x, feature.y, feature.z],
      [feature.width, feature.height, feature.depth],
    );
  }
}
