// The Waal landmarks: the two cell-bound sights on the south bank, and the
// spans that carry the road over the water and over the Vierdaagse route.
// The cell-bound ones follow the CellBuilder contract in cell-build.ts.
//
// The two spans draw structure only, never a deck; park.ts lays the deck and
// places these on top of it. bridgeArch works from the middle of the water,
// where the road runs along z and the water is WAAL_WIDTH wide along that
// same axis; gladiolaArch works from the middle of a road, spanning it along x.

import * as THREE from "three";
import { beam } from "./machines.ts";
import { COLORS, MATERIALS, standard } from "./palette.ts";
import type { StaticBuilder, Vec3 } from "./static-builder.ts";
import type { CellBuilder } from "./cell-build.ts";

// ---------- Shared materials (module-level, so lots merge across sessions) ----------

const tufa = standard("#cfc6ae", { roughness: 0.95 });
const kapelRoof = standard("#5a4a3c", { roughness: 0.9 });
const ruinStone = standard("#8f8a7c", { roughness: 1 });
const hillGrass = standard("#233129", { roughness: 1 });
const pathGravel = standard("#8a8578", { roughness: 1 });
const keerMuur = standard("#6b6a63", { roughness: 0.95 });

const gevelColors = ["#7a4a3c", "#8a6a3a", "#4c5a6b", "#6b4c5a", "#3a5a4c", "#8a7a4a", "#5a4a6b"].map((c) =>
  standard(c),
);
const bakstenenToren = standard("#7a3f34", { roughness: 0.95 });
const glasDoos = standard(COLORS.glass, { roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.7 });
const terrasVloer = standard("#9a958a", { roughness: 0.9 });
const parasolColors = ["#8a3c3c", "#3c6b8a", "#c48a2a"].map((c) => standard(c));
const raamLicht = new THREE.MeshStandardMaterial({
  color: "#2a2620",
  emissive: COLORS.windowLight,
  emissiveIntensity: 0.9,
  roughness: 0.6,
});
const raamDonker = standard("#2a2620", { roughness: 0.6 });

const brugRood = standard(COLORS.band, { roughness: 0.6, metalness: 0.3 });
const brugGrijs = standard("#a9adb1", { roughness: 0.55, metalness: 0.3 });
const brugLicht = new THREE.MeshStandardMaterial({
  color: "#fff4d6",
  emissive: "#fff1c9",
  emissiveIntensity: 0.7,
  roughness: 0.5,
});

const pilaar = standard("#c9c7c0", { roughness: 0.9 });
const boogBalk = standard("#c9c7c0", { roughness: 0.9 });
const gladiolaColors = ["#c23b3b", "#d97a9c", "#f0ece0", "#e6c23a", "#e08a2e"].map((c) => standard(c));

function pick<T>(rand: () => number, options: T[]): T {
  return options[Math.floor(rand() * options.length) % options.length];
}

// ---------- valkhof ----------

const valkhof: CellBuilder = (b, rand) => {
  // Grass base, shifted toward the north edge (the water side).
  b.box(hillGrass, [0, -0.05, 0], [40, 0.1, 40]);

  // The heuvel: a low, wide plateau centered toward the north (water) side.
  const hillX = 2;
  const hillZ = 3;
  b.cylinder(hillGrass, [hillX, 1.5, hillZ], [14, 3, 14]);

  // Sint-Nicolaaskapel: an octagonal tufa building with a cone roof, on the plateau.
  const kapelX = -3;
  const kapelZ = 5;
  const kapelRadius = 3.2;
  const kapelHeight = 6;
  b.cylinder(tufa, [kapelX, 3 + kapelHeight / 2, kapelZ], [kapelRadius, kapelHeight, kapelRadius]);
  b.cylinder(kapelRoof, [kapelX, 3 + kapelHeight + 1.5, kapelZ], [kapelRadius + 0.4, 3, kapelRadius + 0.4]);

  // Barbarossaruïne: a broken ring of wall segments with round arch openings,
  // missing one side entirely.
  const ruinX = 6;
  const ruinZ = 4;
  const ruinRadius = 5.5;
  const ruinHeight = 4.2;
  const segments = 10;
  for (let i = 0; i < segments; i++) {
    if (i === 3 || i === 4) continue; // the broken side
    const angle = (i / segments) * Math.PI * 2;
    const sx = ruinX + Math.sin(angle) * ruinRadius;
    const sz = ruinZ + Math.cos(angle) * ruinRadius;
    const segWidth = (2 * Math.PI * ruinRadius) / segments;
    // Alternate slightly ragged heights so it reads as a ruin, deterministic per seed.
    const height = ruinHeight * (0.6 + rand() * 0.4);
    b.box(ruinStone, [sx, 3 + height / 2, sz], [segWidth * 0.85, height, 0.6], [0, angle, 0]);
    // A round arch opening: two short piers with a gap, simplified as a lower
    // notch by leaving the bottom third open on every other segment.
    if (i % 2 === 0) {
      b.box(ruinStone, [sx, 3 + 0.3, sz], [segWidth * 0.85, 0.6, 0.65], [0, angle, 0]);
    }
  }

  // Paths across the plateau and down to the yard.
  b.box(pathGravel, [0, 3.02, 8], [6, 0.05, 10]);
  b.box(pathGravel, [0, 0.02, 15], [6, 0.05, 8]);

  // A low keermuur along the north edge of the hill, where it meets the water side.
  b.box(keerMuur, [0, 1.6, 16], [30, 3.2, 1]);

  // Trees around the park.
  for (let i = 0; i < 8; i++) {
    const x = -18 + rand() * 36;
    const z = -18 + rand() * 12;
    if (Math.hypot(x - hillX, z - hillZ) < 14) continue;
    const scale = 0.7 + rand() * 0.4;
    b.cylinder(MATERIALS.trunk, [x, 0.6 * scale, z], [0.18 * scale, 1.2 * scale, 0.18 * scale]);
    b.cylinder(MATERIALS.pineDark, [x, 1.9 * scale, z], [1.5 * scale, 2.4 * scale, 1.5 * scale]);
    b.cylinder(MATERIALS.pineLight, [x, 3.1 * scale, z], [1.15 * scale, 2 * scale, 1.15 * scale]);
  }
};

// ---------- waalkade ----------

const waalkade: CellBuilder = (b, rand) => {
  b.box(pathGravel, [0, -0.05, 0], [40, 0.1, 40]);

  const count = 6 + Math.floor(rand() * 3); // 6..8 panden
  const width = 30 / count;
  const depth = 6;
  const rowZ = 6; // toward the water, north side
  const startX = -16 + width / 2;

  for (let i = 0; i < count; i++) {
    const x = startX + i * width;
    const wall = pick(rand, gevelColors);
    const height = 6 + rand() * 3;

    b.box(wall, [x, height / 2, rowZ], [width - 0.2, height, depth]);

    // A puntgevel: pick trapgevel, klokgevel or tuitgevel, all a triangular
    // or stepped shape sitting above the flat wall top.
    const gevelStyle = Math.floor(rand() * 3);
    if (gevelStyle === 0) {
      // Trapgevel: three stacked, narrowing steps.
      for (let s = 0; s < 3; s++) {
        const stepW = (width - 0.2) * (1 - s * 0.28);
        b.box(wall, [x, height + 0.6 + s * 1.2, rowZ - depth / 2 + 0.3], [stepW, 1.2, 0.5]);
      }
    } else if (gevelStyle === 1) {
      // Klokgevel: a rounded top approximated with a stepped-in cylinder cap.
      b.cylinder(wall, [x, height + 0.4, rowZ - depth / 2 + 0.3], [width * 0.4, 0.8, 0.4]);
      b.box(wall, [x, height + 1.4, rowZ - depth / 2 + 0.3], [width * 0.5, 1.2, 0.5]);
    } else {
      // Tuitgevel: a plain triangular top.
      const rise = 2 + rand();
      const slope = Math.sqrt(rise * rise + (width / 2) * (width / 2));
      const angle = Math.atan2(rise, width / 2);
      b.box(wall, [x, height + rise / 2, rowZ - depth / 2 + 0.15], [width - 0.2, 0.2, slope], [0, 0, angle]);
      b.box(wall, [x, height + rise / 2, rowZ - depth / 2 + 0.15], [width - 0.2, 0.2, slope], [0, 0, -angle]);
    }

    // Verlichte ramen op de gevel naar het water.
    const frontZ = rowZ - depth / 2 - 0.03;
    for (let row = 0; row < 2; row++) {
      const lit = rand() < 0.5;
      b.box(lit ? raamLicht : raamDonker, [x, height * 0.35 + row * height * 0.35, frontZ], [width - 1, 1.4, 0.08]);
    }

    // Terras met parasol of stoelen.
    const terraceZ = frontZ - 2.2 - rand() * 1.2;
    b.box(terrasVloer, [x, 0.02, terraceZ], [width - 0.3, 0.05, 3]);
    if (rand() < 0.6) {
      const parasol = pick(rand, parasolColors);
      b.cylinder(MATERIALS.darkSteel, [x, 1, terraceZ], [0.05, 2, 0.05]);
      b.cylinder(parasol, [x, 2.05, terraceZ], [1.1, 0.06, 1.1]);
      b.box(MATERIALS.wood, [x, 0.5, terraceZ], [0.7, 1, 0.7]);
    } else {
      for (const side of [-0.6, 0.6]) {
        b.box(MATERIALS.wood, [x + side, 0.4, terraceZ], [0.4, 0.8, 0.4]);
      }
    }
  }

  // De Bastei at one end: a round brick tower with an angular glass box
  // sticking half through it.
  const basteiX = 17;
  const basteiZ = rowZ - depth / 2 - 3;
  b.cylinder(bakstenenToren, [basteiX, 5, basteiZ], [3, 10, 3]);
  b.box(glasDoos, [basteiX + 0.8, 6.5, basteiZ - 1], [3, 5, 3], [0, Math.PI / 6, 0]);
};

export const RIVER_LANDMARKS: Record<"valkhof" | "waalkade", CellBuilder> = {
  valkhof,
  waalkade,
};

// ---------- bridges ----------

const ARCH_SPAN = 36; // longer than the water so it lands on both banks
const ROAD_HALF = 5;

// A row of vertical hangers from a boog point down to the deck.
function hanger(b: StaticBuilder, material: THREE.Material, x: number, archY: number, z: number) {
  beam(b, material, [x, archY, z], [x, 0, z], 0.16);
}

export function bridgeArch(b: StaticBuilder, kind: "oversteek" | "waalbrug"): void {
  if (kind === "waalbrug") {
    // A symmetric parabolic arch, centered over the water, with two ribs
    // (one per side of the deck) and a light vakwerk cross-bracing.
    const peak = 14;
    const segments = 16;
    for (const side of [-ROAD_HALF - 0.6, ROAD_HALF + 0.6]) {
      let prev: Vec3 = [side, 0, -ARCH_SPAN / 2];
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const z = -ARCH_SPAN / 2 + t * ARCH_SPAN;
        const u = (z / (ARCH_SPAN / 2)) ** 2;
        const y = peak * Math.max(0, 1 - u);
        const point: Vec3 = [side, y, z];
        beam(b, brugRood, prev, point, 0.5);
        prev = point;
      }
      // Vertical hangers from the arch down to deck level, every other segment.
      for (let i = 2; i < segments; i += 2) {
        const t = i / segments;
        const z = -ARCH_SPAN / 2 + t * ARCH_SPAN;
        const u = (z / (ARCH_SPAN / 2)) ** 2;
        const y = peak * Math.max(0, 1 - u);
        if (y > 0.5) hanger(b, brugRood, side, y, z);
      }
    }
    // Light diagonal cross-bracing between the two ribs, at the crown.
    beam(b, brugRood, [-ROAD_HALF - 0.6, peak, 0], [ROAD_HALF + 0.6, peak, 0], 0.3);
    beam(b, brugRood, [-ROAD_HALF - 0.6, peak * 0.7, -8], [ROAD_HALF + 0.6, peak * 0.7, 8], 0.2);
    beam(b, brugRood, [-ROAD_HALF - 0.6, peak * 0.7, 8], [ROAD_HALF + 0.6, peak * 0.7, -8], 0.2);
  } else {
    // An asymmetric, sloped steel arch: steep on the south end, shallow on
    // the north, with tuien (stay cables) down to the deck. One rib, off to
    // one side of the deck, in light steel grey.
    const peak = 16;
    const peakZ = -ARCH_SPAN / 2 + ARCH_SPAN * 0.28; // peak shifted toward the steep end
    const side = ROAD_HALF + 1;
    const segments = 18;
    let prev: Vec3 = [side, 0, -ARCH_SPAN / 2];
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const z = -ARCH_SPAN / 2 + t * ARCH_SPAN;
      const y =
        z <= peakZ
          ? peak * Math.sin(((z - -ARCH_SPAN / 2) / (peakZ - -ARCH_SPAN / 2)) * (Math.PI / 2))
          : peak * Math.sin(((ARCH_SPAN / 2 - z) / (ARCH_SPAN / 2 - peakZ)) * (Math.PI / 2));
      const point: Vec3 = [side, Math.max(0, y), z];
      beam(b, brugGrijs, prev, point, 0.55);
      prev = point;

      // Tuien down to the deck, every couple of segments past the peak.
      if (i % 2 === 0 && y > 1) hanger(b, brugGrijs, side, y, z);
    }

    // A row of low lightmasts along the deck, one shared emissive material.
    for (let z = -ARCH_SPAN / 2 + 3; z <= ARCH_SPAN / 2 - 3; z += 6) {
      const mastX = -ROAD_HALF - 0.8;
      b.cylinder(brugGrijs, [mastX, 1, z], [0.08, 2, 0.08]);
      b.box(brugLicht, [mastX, 2.05, z], [0.3, 0.15, 0.3]);
    }
  }
}

// ---------- gladiolenboog ----------

export function gladiolaArch(b: StaticBuilder): void {
  const clearance = 6.2;
  const pillarHeight = clearance;
  const span = ROAD_HALF * 2 + 1.6;

  // Two pilaartjes flanking the road.
  for (const side of [-1, 1]) {
    b.box(pilaar, [side * (ROAD_HALF + 0.8), pillarHeight / 2, 0], [0.6, pillarHeight, 0.6]);
  }

  // A gebogen balk between them, drawn as short segments along an arc that
  // stays above the clearance height.
  const segments = 10;
  const rise = 1.2;
  let prev: Vec3 = [-span / 2, pillarHeight, 0];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const x = -span / 2 + t * span;
    const y = pillarHeight + rise * Math.sin(t * Math.PI);
    const point: Vec3 = [x, y, 0];
    beam(b, boogBalk, prev, point, 0.4);
    prev = point;
  }

  // A dense row of small colored blocks (gladiolen) along the arch, just
  // above and following the same curve, offset slightly in z for depth.
  const flowerCount = 24;
  for (let i = 0; i < flowerCount; i++) {
    const t = i / (flowerCount - 1);
    const x = -span / 2 + t * span;
    const y = pillarHeight + rise * Math.sin(t * Math.PI) + 0.35;
    const color = gladiolaColors[i % gladiolaColors.length];
    b.box(color, [x, y, 0.4], [0.35, 0.5, 0.35]);
    b.box(color, [x, y, -0.4], [0.35, 0.5, 0.35]);
  }
}
