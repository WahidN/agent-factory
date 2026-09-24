// A small, deterministic visual grammar for Nijmegen's neighbourhoods.
//
// Generic filler cells still provide their useful base composition. This
// module adds a few broad, recognisable cues on top: tight brick stoops in the
// old city, leafy pale-brick frontage in Oost, light contemporary volumes in
// Waalsprong and hedges/orchards at the green edge. All pieces use plain,
// module-level materials, so StaticBuilder folds them into its baked mesh.

import type { Amenity, Cell } from "./city-plan.ts";
import { WAAL_EDGE } from "./city-plan.ts";
import { FILLER_BUILDERS } from "./filler.ts";
import { MATERIALS, standard } from "./palette.ts";
import type { StaticBuilder } from "./static-builder.ts";

export type District = "benedenstad" | "oost" | "waalsprong" | "stadsrand";
export type FillerAmenity = keyof typeof FILLER_BUILDERS;

const oldBrick = standard("#8f4f3f", { roughness: 0.94 });
const oldStone = standard("#c4b79e", { roughness: 0.96 });
const eastBrick = standard("#b68a68", { roughness: 0.94 });
const eastTrim = standard("#eee3cf", { roughness: 0.9 });
const newBrick = standard("#d7c5a5", { roughness: 0.92 });
const newWhite = standard("#ecece5", { roughness: 0.86 });
const waterGreen = standard("#72947b", { roughness: 1 });
const hedge = standard("#3e7044", { roughness: 1 });
const orchard = standard("#63824d", { roughness: 1 });
const gravel = standard("#b7aa8d", { roughness: 1 });
const canopy = standard("#596d70", { roughness: 0.76, metalness: 0.08 });

const fillerAmenities = new Set<FillerAmenity>(["park", "houses", "shops", "field"]);

export function isFillerAmenity(amenity: Amenity): amenity is FillerAmenity {
  return fillerAmenities.has(amenity as FillerAmenity);
}

// The Waal is the strongest boundary. Close to its south bank is the compact
// historic city; further east the long garden streets of Nijmegen-Oost take
// over. Growth north of the river reads as Waalsprong until it opens into the
// greener edge. These bands are intentionally broad, not a cadastral map.
export function districtForCell({ col, row }: Cell): District {
  if (row >= WAAL_EDGE) return row <= WAAL_EDGE + 4 && col <= 10 ? "waalsprong" : "stadsrand";
  if (col <= 3) return "benedenstad";
  if (col <= 10) return "oost";
  return "stadsrand";
}

// A stable cell hash for choices which should not consume the builder's rand
// stream. This keeps a district accent unchanged when a base composition gets
// another seeded detail later.
export function districtVariant(cell: Cell, variants: number): number {
  if (variants <= 0 || !Number.isInteger(variants)) throw new Error("variants must be a positive integer");
  let hash = Math.imul(cell.col, 73_856_093) ^ Math.imul(cell.row, 19_349_663) ^ 0x4e696a6d;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash >>> 0) % variants;
}

export function buildDistrictFiller(amenity: FillerAmenity, builder: StaticBuilder, rand: () => number, cell: Cell) {
  FILLER_BUILDERS[amenity](builder, rand);
  decorateDistrictCell(builder, amenity, cell);
}

function decorateDistrictCell(builder: StaticBuilder, amenity: FillerAmenity, cell: Cell) {
  const district = districtForCell(cell);
  const variant = districtVariant(cell, 3);

  if (district === "benedenstad") {
    // A continuous warm plinth and shallow stone stoops reinforce the narrow,
    // joined-up street wall without adding more individual buildings. Only
    // the shops leave that strip free, behind their row; every other
    // composition gets the stone edge along its north side instead.
    if (amenity === "shops") {
      builder.box(oldBrick, [0, 0.38, -10.05], [35, 0.76, 0.38]);
      for (let x = -14 + variant; x <= 14; x += 7) {
        builder.box(oldStone, [x, 0.16, -10.7], [2.2, 0.32, 1.05]);
      }
    } else {
      builder.box(oldStone, [0, 0.08, 17.4], [30, 0.16, 1.3]);
    }
    return;
  }

  if (district === "oost") {
    // Oost is read through green front gardens, pale bay-like projections and
    // a measured avenue rhythm rather than a different roof gimmick.
    builder.box(hedge, [0, 0.42, 17.2], [34, 0.84, 0.65]);
    // The bays sit against the back of the northern house row; in the open
    // shops square they would stand alone.
    if (amenity === "houses") {
      for (const x of [-12 + variant, -4 + variant, 4 + variant, 12 + variant]) {
        builder.box(eastBrick, [x, 2.7, 12.1], [3.2, 5.4, 1.1]);
        builder.box(eastTrim, [x, 5.55, 12.1], [3.5, 0.3, 1.25]);
      }
    }
    return;
  }

  if (district === "waalsprong") {
    // Light, staggered contemporary frames and rain-garden strips distinguish
    // the new northern neighbourhood without glass shaders or unique meshes.
    builder.box(waterGreen, [0, 0.06, 17], [31, 0.12, 2.1]);
    if (amenity === "houses" || amenity === "shops") {
      for (const [x, z, h] of [
        [-11 + variant, 12.8, 4.4],
        [0, 14.2, 5.2],
        [11 - variant, 12.4, 4.7],
      ] as const) {
        builder.box(newBrick, [x, h / 2, z], [5.2, h, 2.5]);
        builder.box(newWhite, [x, h + 0.18, z], [5.7, 0.36, 2.9]);
      }
      builder.box(canopy, [0, 2.75, 15.3], [28, 0.22, 1.1]);
    }
    return;
  }

  // At the city edge, repeated hedgerows and a tiny orchard are more useful
  // silhouettes than another building facade. Houses and shops fill the cell
  // from edge to edge, so only open compositions get the hedge and gravel
  // path, and only a sports field leaves the strip outside its fence free for
  // the orchard.
  if (amenity === "houses" || amenity === "shops") return;
  // Just below a sports field's 0.08 surface, which it overlaps at x 13.6-14.
  builder.box(gravel, [14.8, 0.035, 0], [2.4, 0.07, 31]);
  builder.box(hedge, [-17.1, 0.55, 0], [0.7, 1.1, 34]);
  if (amenity !== "field") return;
  for (const z of [-10 + variant, 0 + variant, 10 + variant]) {
    builder.cylinder(MATERIALS.trunk, [18, 0.85, z], [0.18, 1.7, 0.18]);
    builder.cylinder(orchard, [18, 2.35, z], [1.45, 1.5, 1.45]);
  }
}
