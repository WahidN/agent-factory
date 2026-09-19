// The Waal landmarks: two cell-bound sights on the south bank, the named road
// bridges, the separate railway bridge, and the Vierdaagse route arch.
// The cell-bound ones follow the CellBuilder contract in cell-build.ts.
//
// Road spans draw structure only; park.ts lays their road decks underneath.
// railBridge owns its rail deck so it can never turn into a traffic crossing.
// All river bridges work from midstream, along z; gladiolaArch spans along x.

import * as THREE from "three";
import { RAIL_BRIDGE_SPAN } from "./city-plan.ts";
import { beam } from "./machines.ts";
import { COLORS, MATERIALS, standard } from "./palette.ts";
import type { StaticBuilder, Vec3 } from "./static-builder.ts";
import type { CellBuilder } from "./cell-build.ts";

// ---------- Shared materials (module-level, so lots merge across sessions) ----------

const tufa = standard("#ddd1b6", { roughness: 0.95 });
const kapelRoof = standard("#594b43", { roughness: 0.9 });
const ruinStone = standard("#aaa28f", { roughness: 1 });
const hillGrass = standard("#56834b", { roughness: 1 });
const pathGravel = standard("#b6aa90", { roughness: 1 });
const keerMuur = standard("#85847b", { roughness: 0.95 });
const chapelDark = standard("#252b2b", { roughness: 0.75 });
const roofTile = standard("#4f4842", { roughness: 0.95 });
const quayStone = standard("#777a76", { roughness: 1 });

const gevelColors = ["#a75e49", "#b18a49", "#668099", "#876578", "#54806a", "#ad995f", "#79658e"].map((c) =>
  standard(c),
);
const bakstenenToren = standard("#985044", { roughness: 0.95 });
const basteiBrick = standard("#9a654c", { roughness: 0.9 });
const glasDoos = standard(COLORS.glass, { roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.7 });
const terrasVloer = standard("#bbb4a5", { roughness: 0.9 });
const parasolColors = ["#8a3c3c", "#3c6b8a", "#c48a2a"].map((c) => standard(c));
const raamLicht = standard("#2a2620", {
  emissive: COLORS.windowLight,
  emissiveIntensity: 0.9,
  roughness: 0.6,
});
const raamDonker = standard("#2a2620", { roughness: 0.6 });

// An actual eight-sided drum is important to the Sint-Nicolaaskapel's
// silhouette. Keep it module-level so no geometry is allocated per cell.
const octagonalDrum = new THREE.CylinderGeometry(1, 1, 1, 8);

const brugRood = standard(COLORS.band, { roughness: 0.6, metalness: 0.3 });
const oversteekSteel = standard("#d3d1c9", { roughness: 0.48, metalness: 0.38 });
const cableSteel = standard("#7a8288", { roughness: 0.45, metalness: 0.55 });
const railSteel = standard("#4b555c", { roughness: 0.55, metalness: 0.5 });
const railRust = standard("#74584c", { roughness: 0.78, metalness: 0.2 });
const railBrick = standard("#865044", { roughness: 0.92 });
const brugLicht = standard("#fff4d6", {
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
  b.box(hillGrass, [0, 0.025, 0], [40, 0.05, 40]);

  // The heuvel: a low, wide plateau centered toward the north (water) side.
  const hillX = 2;
  const hillZ = 3;
  b.cylinder(hillGrass, [hillX, 1.5, hillZ], [14, 3, 14]);

  // Sint-Nicolaaskapel: a compact octagonal Romanesque chapel with a low roof,
  // stone belt course and small, dark round-arched openings.
  const kapelX = -3;
  const kapelZ = 5;
  const kapelRadius = 3.2;
  const kapelHeight = 6;
  b.add(octagonalDrum, tufa, [kapelX, 3 + kapelHeight / 2, kapelZ], [kapelRadius, kapelHeight, kapelRadius]);
  b.add(octagonalDrum, ruinStone, [kapelX, 5.2, kapelZ], [kapelRadius + 0.12, 0.35, kapelRadius + 0.12]);
  b.add(octagonalDrum, tufa, [kapelX, 6.7, kapelZ], [kapelRadius * 0.82, 1.4, kapelRadius * 0.82]);
  b.cone(kapelRoof, [kapelX, 3 + kapelHeight + 1.35, kapelZ], [kapelRadius + 0.25, 2.7, kapelRadius + 0.25]);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = kapelRadius + 0.03;
    b.box(
      chapelDark,
      [kapelX + Math.sin(angle) * radius, 5.7, kapelZ + Math.cos(angle) * radius],
      [0.65, 1.65, 0.09],
      [0, angle, 0],
    );
  }

  // Barbarossaruïne: the surviving semicircular choir apse. Separate piers and
  // lintels leave real openings between them, a much clearer read than the old
  // almost-complete ring of solid blocks.
  const ruinX = 6;
  const ruinZ = 4;
  const ruinRadius = 4.5;
  const ruinHeight = 6.2;
  const segments = 7;
  for (let i = 0; i < segments; i++) {
    const angle = -Math.PI / 2 + (i / (segments - 1)) * Math.PI;
    const sx = ruinX + Math.sin(angle) * ruinRadius;
    const sz = ruinZ + Math.cos(angle) * ruinRadius;
    const height = ruinHeight * (0.86 + rand() * 0.14);
    b.box(ruinStone, [sx, 3 + height / 2, sz], [0.75, height, 0.75], [0, angle, 0]);
    if (i < segments - 1) {
      const nextAngle = -Math.PI / 2 + ((i + 1) / (segments - 1)) * Math.PI;
      const midAngle = (angle + nextAngle) / 2;
      const chord = 2 * ruinRadius * Math.sin((nextAngle - angle) / 2);
      b.box(
        ruinStone,
        [ruinX + Math.sin(midAngle) * ruinRadius, 3 + ruinHeight - 0.45, ruinZ + Math.cos(midAngle) * ruinRadius],
        [chord + 0.25, 0.9, 0.7],
        [0, midAngle, 0],
      );
    }
  }
  // The two pale columns that frame the open side survive as a distinctive pair.
  for (const z of [ruinZ - ruinRadius, ruinZ + ruinRadius]) {
    b.cylinder(tufa, [ruinX - 0.25, 6.1, z], [0.34, 6.2, 0.34]);
  }

  // Paths across the plateau and down to the yard.
  b.box(pathGravel, [0, 3.02, 8], [6, 0.05, 10]);
  b.box(pathGravel, [0, 0.075, 15], [6, 0.05, 8]);

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
  // Keep the paving wholly above the meadow. Its old top face sat exactly at
  // y=0 with the infinite ground plane, which caused depth-buffer flicker.
  b.box(pathGravel, [0, 0.025, 0], [40, 0.05, 40]);

  // Two-level stone quay facing the Waal, with broad stairs and dark mooring
  // bollards. It anchors the facade row to the river rather than open paving.
  b.box(quayStone, [0, 0.45, -12.5], [40, 0.9, 4.5]);
  b.box(pathGravel, [0, 0.94, -12.5], [40, 0.08, 4.5]);
  for (let step = 0; step < 4; step++) {
    b.box(quayStone, [-10, 0.15 + step * 0.2, -9.8 - step * 0.55], [7, 0.2, 0.9]);
  }
  for (const x of [-16, -8, 0, 8, 16]) {
    b.cylinder(MATERIALS.darkSteel, [x, 1.25, -13.7], [0.22, 0.55, 0.22]);
    b.box(MATERIALS.darkSteel, [x, 1.58, -13.7], [0.7, 0.12, 0.3]);
  }

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
    b.box(roofTile, [x, height + 0.2, rowZ + 0.7], [width, 0.4, depth - 1]);

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
      // Tuitgevel: two sloping sides meeting at the ridge. Each side runs
      // along x from the wall's corner to the apex and is tilted about z.
      const rise = 2 + rand();
      const slope = Math.sqrt(rise * rise + (width / 2) * (width / 2));
      const angle = Math.atan2(rise, width / 2);
      const gevelZ = rowZ - depth / 2 + 0.15;
      b.box(wall, [x - width / 4, height + rise / 2, gevelZ], [slope, 0.2, 0.5], [0, 0, angle]);
      b.box(wall, [x + width / 4, height + rise / 2, gevelZ], [slope, 0.2, 0.5], [0, 0, -angle]);
    }

    // Narrow individual sash windows preserve the vertical rhythm of the
    // historic waterfront houses better than one broad glowing stripe.
    const frontZ = rowZ - depth / 2 - 0.03;
    for (let row = 0; row < 2; row++) {
      for (const offset of [-0.22, 0.22]) {
        const lit = rand() < 0.5;
        b.box(
          lit ? raamLicht : raamDonker,
          [x + offset * width, height * 0.32 + row * height * 0.34, frontZ],
          [Math.max(0.5, width * 0.24), 1.25, 0.08],
        );
      }
    }

    // Terras met parasol of stoelen.
    const terraceZ = frontZ - 2.2 - rand() * 1.2;
    // The terrace also needs its own height layer instead of intersecting the
    // quay paving below it.
    b.box(terrasVloer, [x, 0.075, terraceZ], [width - 0.3, 0.05, 3]);
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

  // De Bastei at the foot of the Valkhof: a heavy, curved brick fortification
  // rising from the quay with the modern angular glass pavilion set into it.
  const basteiX = 16.4;
  const basteiZ = rowZ - depth / 2 - 3;
  b.box(basteiBrick, [basteiX - 2.2, 3.2, basteiZ + 2], [5, 6.4, 7]);
  b.cylinder(bakstenenToren, [basteiX, 4.2, basteiZ], [3.3, 8.4, 3.3]);
  b.cylinder(quayStone, [basteiX, 1, basteiZ], [3.55, 1.2, 3.55]);
  b.box(glasDoos, [basteiX - 0.6, 7.1, basteiZ - 1.1], [4.5, 3.6, 3.2], [0, Math.PI / 9, 0]);
  b.box(roofTile, [basteiX - 0.6, 9.05, basteiZ - 1.1], [4.9, 0.3, 3.6], [0, Math.PI / 9, 0]);
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
    // The 1936 Waalbrug: two heavy through-arch ribs, close vertical hangers
    // and repeated overhead portals. The dense rectangular rhythm separates
    // it immediately from De Oversteek's one clean sweep and fan cables.
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
      // Vertical hangers at every panel make the old steel bridge read as a
      // truss even at the map's normal camera distance.
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const z = -ARCH_SPAN / 2 + t * ARCH_SPAN;
        const u = (z / (ARCH_SPAN / 2)) ** 2;
        const y = peak * Math.max(0, 1 - u);
        if (y > 0.5) hanger(b, brugRood, side, y, z);
      }
    }
    // Portal beams and alternating diagonals tie the two red steel ribs into
    // the Waalbrug's characteristic overhead lattice.
    for (const z of [-12, -8, -4, 0, 4, 8, 12]) {
      const y = peak * Math.max(0, 1 - (z / (ARCH_SPAN / 2)) ** 2);
      beam(b, brugRood, [-ROAD_HALF - 0.6, y, z], [ROAD_HALF + 0.6, y, z], 0.32);
    }
    beam(b, brugRood, [-ROAD_HALF - 0.6, peak * 0.65, -9], [ROAD_HALF + 0.6, peak * 0.65, 9], 0.2);
    beam(b, brugRood, [-ROAD_HALF - 0.6, peak * 0.65, 9], [ROAD_HALF + 0.6, peak * 0.65, -9], 0.2);
  } else {
    // An asymmetric, sloped steel arch: steep on the south end, shallow on
    // the north, with fan cables down to both sides of the deck. One centered
    // rib in pale steel keeps its silhouette open and contemporary.
    const peak = 16;
    const peakZ = -ARCH_SPAN / 2 + ARCH_SPAN * 0.28; // peak shifted toward the steep end
    const side = 0;
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
      beam(b, oversteekSteel, prev, point, 0.55);
      prev = point;

      // Slender fan cables land alternately on either edge and slightly ahead
      // or behind their arch point, which gives De Oversteek its open cable
      // picture instead of the Waalbrug's vertical hanger wall.
      if (i % 2 === 0 && y > 2) {
        const deckX = i % 4 === 0 ? -ROAD_HALF : ROAD_HALF;
        const deckZ = Math.max(-ARCH_SPAN / 2, Math.min(ARCH_SPAN / 2, z + (i < segments / 2 ? 3 : -3)));
        beam(b, cableSteel, point, [deckX, 0, deckZ], 0.1);
      }
    }

    // A row of low lightmasts along the deck, one shared emissive material.
    for (let z = -ARCH_SPAN / 2 + 3; z <= ARCH_SPAN / 2 - 3; z += 6) {
      const mastX = -ROAD_HALF - 0.8;
      b.cylinder(oversteekSteel, [mastX, 1, z], [0.08, 2, 0.08]);
      b.box(brugLicht, [mastX, 2.05, z], [0.3, 0.15, 0.3]);
    }
  }
}

// ---------- spoorbrug ----------

// A self-contained railway crossing: deck, sleepers, rails, polygonal truss,
// bank piers and the Cuypers-inspired brick gate towers. Park places this as a
// fixed landmark; it is intentionally never registered as a road crossing.
export function railBridge(b: StaticBuilder): void {
  const span = RAIL_BRIDGE_SPAN;
  const half = span / 2;
  const trussX = 3.4;
  const deckY = 0.45;

  b.box(railSteel, [0, deckY - 0.28, 0], [7.2, 0.55, span]);
  for (let z = -half + 1; z < half; z += 2) {
    b.box(MATERIALS.wood, [0, deckY + 0.08, z], [5.6, 0.18, 0.42]);
  }
  for (const x of [-1.05, 1.05]) {
    b.box(railRust, [x, deckY + 0.25, 0], [0.16, 0.16, span]);
  }

  // Polygonal through-truss, one rib on either side of the double track.
  const segments = 12;
  const peak = 10.5;
  for (const x of [-trussX, trussX]) {
    let previous: Vec3 = [x, 1.1, -half];
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const z = -half + t * span;
      const y = 1.1 + peak * Math.max(0, 1 - (z / half) ** 2);
      const point: Vec3 = [x, y, z];
      beam(b, railSteel, previous, point, 0.38);
      if (i < segments) {
        beam(b, railSteel, point, [x, 0.75, z], 0.2);
        const nextZ = -half + ((i + 1) / segments) * span;
        beam(b, railSteel, point, [x, 0.75, nextZ], 0.16);
      }
      previous = point;
    }
    b.box(railSteel, [x, 0.82, 0], [0.28, 0.45, span]);
  }

  // Five overhead portals make the lattice unmistakably railway engineering.
  for (const z of [-12, -6, 0, 6, 12]) {
    const y = 1.1 + peak * Math.max(0, 1 - (z / half) ** 2);
    beam(b, railSteel, [-trussX, y, z], [trussX, y, z], 0.28);
  }

  for (const z of [-half + 1.2, half - 1.2]) {
    b.box(pilaar, [0, -0.15, z], [8.6, 1.8, 2]);
  }

  // The surviving Nijmegen-side entrance is abstracted as two compact brick
  // gate towers. Their paired silhouette distinguishes this from a generic
  // modern rail bridge without expensive custom geometry.
  const gateZ = -half - 0.8;
  for (const x of [-trussX, trussX]) {
    b.box(railBrick, [x, 3, gateZ], [2.4, 6, 2.4]);
    b.box(ruinStone, [x, 6.15, gateZ], [2.8, 0.4, 2.8]);
    b.box(chapelDark, [x, 3.4, gateZ - 1.22], [0.65, 1.8, 0.08]);
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
