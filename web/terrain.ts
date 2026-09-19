// Cheap, static relief cues for Nijmegen. Roads and lots remain on y = 0;
// these low retaining terraces and dike shoulders occupy only the green bank
// strips, so navigation and traffic paths need no height awareness.

import type { Cell } from "./city-plan.ts";
import { crossingAt, RAIL_BRIDGE, WAAL_EDGE, WAAL_WIDTH } from "./city-plan.ts";
import { standard } from "./palette.ts";
import { PLOT_SIZE } from "./plots.ts";
import type { StaticBuilder } from "./static-builder.ts";

export type TerrainFeature = {
  kind: "north-dike" | "stuwwal-terrace";
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
};

export type TerrainRiverSpan = { minCol: number; maxCol: number } | null;

const dikeGrass = standard("#5f854c", { roughness: 1 });
const terraceStone = standard("#918b7d", { roughness: 1 });
const terraceGrass = standard("#577d47", { roughness: 1 });

const riverZ = (WAAL_EDGE - 0.5) * PLOT_SIZE;
const northBankZ = riverZ + WAAL_WIDTH / 2;
const southBankZ = riverZ - WAAL_WIDTH / 2;

export function terrainFeaturesForCells(cells: Cell[], river: TerrainRiverSpan): TerrainFeature[] {
  if (!river || cells.length === 0) return [];
  const features: TerrainFeature[] = [];

  // One low shoulder per riverfront column. The individual pieces all bake
  // into one mesh, while the gaps keep every road and rail bridge clear.
  for (let col = river.minCol; col <= river.maxCol; col++) {
    const bridgeAt = (boundary: number) => crossingAt(boundary) !== null || boundary === RAIL_BRIDGE.col;
    const bridgeOnWest = bridgeAt(col);
    const bridgeOnEast = bridgeAt(col + 1);
    const leftGap = bridgeOnWest ? 7 : 1.5;
    const rightGap = bridgeOnEast ? 7 : 1.5;
    const west = (col - 0.5) * PLOT_SIZE + leftGap;
    const east = (col + 0.5) * PLOT_SIZE - rightGap;
    if (east > west) {
      features.push({
        kind: "north-dike",
        x: (west + east) / 2,
        y: 0.28,
        z: northBankZ + 2.7,
        width: east - west,
        height: 0.56,
        depth: 4.6,
      });
    }
  }

  // The Valkhof/stuwwal is already a real raised landmark. Two long, thin
  // terraces connect that hill visually to the riverbank without lifting its
  // cell, nearby roads, or any other building.
  if (cells.some(({ col, row }) => col === 3 && row === 1)) {
    features.push(
      {
        kind: "stuwwal-terrace",
        x: 3 * PLOT_SIZE,
        y: 0.38,
        z: southBankZ - 3.2,
        width: 35,
        height: 0.76,
        depth: 1.2,
      },
      {
        kind: "stuwwal-terrace",
        x: 3 * PLOT_SIZE,
        y: 0.2,
        z: southBankZ - 6.2,
        width: 29,
        height: 0.4,
        depth: 1.5,
      },
    );
  }

  return features;
}

export function appendTerrainRelief(builder: StaticBuilder, cells: Cell[], river: TerrainRiverSpan) {
  for (const feature of terrainFeaturesForCells(cells, river)) {
    builder.box(
      feature.kind === "north-dike" ? dikeGrass : feature.height > 0.5 ? terraceStone : terraceGrass,
      [feature.x, feature.y, feature.z],
      [feature.width, feature.height, feature.depth],
    );
  }
}
