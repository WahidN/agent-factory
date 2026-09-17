// Generic city filler: the archetypes that stand on a claimed cell that is
// not a factory lot or a named landmark. Each builder draws one cell's worth
// of scenery inside CELL_HALF, in cell-local coordinates, with y = 0 as
// ground level. See cell-build.ts for the contract.

import * as THREE from "three";
import type { CellBuilder } from "./cell-build.ts";
import { CELL_HALF } from "./cell-build.ts";
import { COLORS, MATERIALS, standard } from "./palette.ts";
import type { StaticBuilder } from "./static-builder.ts";

// ---------- Shared materials (module-level, so lots merge across sessions) ----------

const pathMaterial = standard("#8a8578", { roughness: 1 });
const waterMaterial = standard("#39586b", { roughness: 0.4, metalness: 0.1 });
const benchMaterial = standard(COLORS.wood);
const hedgeMaterial = standard("#274a30", { roughness: 1 });

const brickReds = ["#8a4a3c", "#93553f", "#7c4436"].map((c) => standard(c));
const brickTans = ["#a08b6a", "#8f7a58", "#b0997a"].map((c) => standard(c));
const houseWalls = [...brickReds, ...brickTans];
const roofDarks = ["#3c3936", "#4a423c"].map((c) => standard(c));

const shopFronts = ["#4c6b73", "#7a5a4a", "#5a6b4c", "#6a5a73"].map((c) => standard(c));
const awningColors = ["#a13c3c", "#3c7a6b", "#c48a2a"].map((c) => standard(c));

const fieldGreen = standard("#2e5b3a", { roughness: 1 });
const lineWhite = standard("#e8e8e0");
const goalWhite = standard("#dcdcd6");
const fenceGrey = standard("#5a5d61");

// A window with `emissive` is textured/glow-only for StaticBuilder's merge
// rules, so every glowing window in this module must share this one
// material or each becomes its own draw call.
const windowLight = new THREE.MeshStandardMaterial({
  color: "#2a2620",
  emissive: COLORS.windowLight,
  emissiveIntensity: 0.9,
  roughness: 0.6,
});
const windowDark = standard("#2a2620", { roughness: 0.6 });

function pick<T>(rand: () => number, options: T[]): T {
  return options[Math.floor(rand() * options.length) % options.length];
}

function window(b: StaticBuilder, position: [number, number, number], lit: boolean) {
  b.box(lit ? windowLight : windowDark, position, [0.9, 1.1, 0.08]);
}

function bench(b: StaticBuilder, x: number, z: number, rotationY: number) {
  b.box(benchMaterial, [x, 0.45, z], [1.6, 0.08, 0.5], [0, rotationY, 0]);
  b.box(benchMaterial, [x, 0.7, z + Math.cos(rotationY) * 0.2 * -1], [1.6, 0.5, 0.08], [0, rotationY, 0]);
  for (const side of [-0.7, 0.7]) {
    const lx = x - Math.sin(rotationY) * side;
    const lz = z + Math.cos(rotationY) * side;
    b.box(MATERIALS.darkSteel, [lx, 0.22, lz], [0.08, 0.44, 0.4], [0, rotationY, 0]);
  }
}

function pineTree(b: StaticBuilder, x: number, z: number, scale: number) {
  b.cylinder(MATERIALS.trunk, [x, 0.6 * scale, z], [0.18 * scale, 1.2 * scale, 0.18 * scale]);
  b.cylinder(MATERIALS.pineDark, [x, 1.9 * scale, z], [1.5 * scale, 2.4 * scale, 1.5 * scale]);
  b.cylinder(MATERIALS.pineLight, [x, 3.1 * scale, z], [1.15 * scale, 2 * scale, 1.15 * scale]);
  b.cylinder(MATERIALS.pineDark, [x, 4.1 * scale, z], [0.75 * scale, 1.6 * scale, 0.75 * scale]);
}

// ---------- park ----------

const park: CellBuilder = (b, rand) => {
  b.box(MATERIALS.grass, [0, -0.05, 0], [CELL_HALF * 2, 0.1, CELL_HALF * 2]);

  // A pair of paths crossing near the middle, offset so they don't sit
  // exactly on the diagonal.
  b.box(pathMaterial, [0, 0.02, 3], [CELL_HALF * 2 - 4, 0.04, 2.4]);
  b.box(pathMaterial, [-3, 0.02, 0], [2.4, 0.04, CELL_HALF * 2 - 4]);

  // A small pond in one corner, with a low rim.
  const pondX = -11;
  const pondZ = -11;
  b.cylinder(MATERIALS.curb, [pondX, 0.12, pondZ], [5.4, 0.24, 5.4]);
  b.cylinder(waterMaterial, [pondX, 0.06, pondZ], [4.9, 0.1, 4.9]);

  // Benches along the paths.
  bench(b, 6, 4.4, 0);
  bench(b, -6.4, 1.6, Math.PI / 2);
  bench(b, 4, -6, Math.PI);

  // Trees scattered on the remaining lawn, away from the paths and pond.
  for (let i = 0; i < 10; i++) {
    const x = (rand() - 0.5) * (CELL_HALF * 2 - 6);
    const z = (rand() - 0.5) * (CELL_HALF * 2 - 6);
    const nearPond = Math.hypot(x - pondX, z - pondZ) < 8;
    const nearPathA = Math.abs(z - 3) < 3;
    const nearPathB = Math.abs(x + 3) < 3;
    if (nearPond || nearPathA || nearPathB) continue;
    pineTree(b, x, z, 0.7 + rand() * 0.4);
  }
};

// ---------- houses ----------

const houses: CellBuilder = (b, rand) => {
  b.box(MATERIALS.grass, [0, -0.05, 0], [CELL_HALF * 2, 0.1, CELL_HALF * 2]);

  const rowCount = 2;
  const perRow = 4 + Math.floor(rand() * 3); // 4..6, two rows gives 8..12 total (six to ten typical after trims)
  const houseWidth = 6.6;
  const houseDepth = 8;

  for (let row = 0; row < rowCount; row++) {
    const z = row === 0 ? -8 : 8;
    const facing = row === 0 ? 1 : -1;
    const totalWidth = perRow * houseWidth;
    const startX = -totalWidth / 2 + houseWidth / 2;

    for (let i = 0; i < perRow; i++) {
      const x = startX + i * houseWidth;
      if (Math.abs(x) > CELL_HALF - houseWidth / 2) continue;

      const wall = pick(rand, houseWalls);
      const roofColor = pick(rand, roofDarks);
      const height = 6.4 + rand() * 1.2;
      const depth = houseDepth - 0.6 + rand() * 0.6;

      // Body.
      b.box(wall, [x, height / 2, z], [houseWidth - 0.3, height, depth]);

      // Pitched roof: two slanted boxes meeting at a ridge along x.
      const roofRise = 2.1;
      const halfDepth = depth / 2 + 0.3;
      const slope = Math.sqrt(roofRise * roofRise + halfDepth * halfDepth);
      const angle = Math.atan2(roofRise, halfDepth);
      b.box(roofColor, [x, height + roofRise / 2, z - halfDepth / 2 + 0.05], [houseWidth, 0.25, slope], [angle, 0, 0]);
      b.box(roofColor, [x, height + roofRise / 2, z + halfDepth / 2 - 0.05], [houseWidth, 0.25, slope], [-angle, 0, 0]);

      // Front door.
      b.box(MATERIALS.wood, [x, 1.1, z + facing * (depth / 2 + 0.03)], [1, 2.2, 0.1]);

      // A couple of windows per house, some lit.
      const winZ = z + facing * (depth / 2 + 0.05);
      window(b, [x - houseWidth / 4, height * 0.6, winZ], rand() < 0.4);
      window(b, [x + houseWidth / 4, height * 0.6, winZ], rand() < 0.4);

      // A small front garden strip, a hedge along the street side.
      const gardenZ = z + facing * (depth / 2 + 1.2);
      b.box(hedgeMaterial, [x, 0.4, gardenZ], [houseWidth - 1, 0.8, 0.5]);

      // A bike leaning against the wall now and then.
      if (rand() < 0.5) {
        const bx = x + houseWidth / 2 - 0.6;
        b.box(MATERIALS.darkSteel, [bx, 0.35, winZ + facing * 0.4], [0.06, 0.7, 1.1], [0, 0, Math.PI / 10]);
      }
    }
  }
};

// ---------- shops ----------

const shops: CellBuilder = (b, rand) => {
  b.box(pathMaterial, [0, -0.05, 0], [CELL_HALF * 2, 0.1, CELL_HALF * 2]);

  const count = 6 + Math.floor(rand() * 3); // 6..8 narrow panels
  const width = (CELL_HALF * 2 - 4) / count;
  const depth = 7;
  const rowZ = -6;
  const startX = -CELL_HALF + 2 + width / 2;

  for (let i = 0; i < count; i++) {
    const x = startX + i * width;
    const front = pick(rand, shopFronts);
    const height = 5.4 + rand() * 1.6;

    b.box(front, [x, height / 2, rowZ], [width - 0.15, height, depth]);
    b.box(MATERIALS.parapet, [x, height + 0.15, rowZ], [width - 0.15, 0.3, depth]);

    // Shop window filling most of the ground floor front.
    const frontZ = rowZ + depth / 2 + 0.03;
    const lit = rand() < 0.55;
    b.box(lit ? windowLight : windowDark, [x, 1.6, frontZ], [width - 1, 2.6, 0.1]);

    // Luifel (awning) over the sidewalk.
    const awning = pick(rand, awningColors);
    b.box(awning, [x, 3.4, frontZ + 0.9], [width - 0.4, 0.12, 1.8], [-0.25, 0, 0]);

    // A terrace: table with a parasol or a couple of chairs.
    const terraceZ = frontZ + 2.4 + rand() * 1.2;
    if (rand() < 0.6) {
      b.cylinder(MATERIALS.darkSteel, [x, 1, terraceZ], [0.05, 2, 0.05]);
      b.cylinder(awning, [x, 2.05, terraceZ], [1.1, 0.06, 1.1]);
      b.box(MATERIALS.wood, [x, 0.5, terraceZ], [0.7, 1, 0.7]);
    } else {
      for (const side of [-0.6, 0.6]) {
        b.box(MATERIALS.wood, [x + side, 0.4, terraceZ], [0.4, 0.8, 0.4]);
      }
    }

    // A bike or two parked against the front.
    if (rand() < 0.4) {
      b.box(MATERIALS.darkSteel, [x + width / 2 - 0.4, 0.35, frontZ + 0.3], [0.06, 0.7, 1.1], [0, 0, -Math.PI / 10]);
    }
  }
};

// ---------- field ----------

const field: CellBuilder = (b, _rand) => {
  b.box(MATERIALS.grass, [0, -0.05, 0], [CELL_HALF * 2, 0.1, CELL_HALF * 2]);

  const fieldW = 28;
  const fieldD = 32;
  b.box(fieldGreen, [0, 0.01, 0], [fieldW, 0.02, fieldD]);

  const lineH = 0.02;
  const lineY = 0.03;
  // Outer touchlines and goal lines.
  b.box(lineWhite, [0, lineY, fieldD / 2], [fieldW, lineH, 0.15]);
  b.box(lineWhite, [0, lineY, -fieldD / 2], [fieldW, lineH, 0.15]);
  b.box(lineWhite, [fieldW / 2, lineY, 0], [0.15, lineH, fieldD]);
  b.box(lineWhite, [-fieldW / 2, lineY, 0], [0.15, lineH, fieldD]);
  // Halfway line and center circle ring, approximated with a thin torus-free
  // ring of short boxes kept simple as a cylinder shell.
  b.box(lineWhite, [0, lineY, 0], [fieldW, lineH, 0.15]);
  b.cylinder(lineWhite, [0, lineY, 0], [3, 0.01, 3]);

  // Two goals, one on each short side.
  for (const side of [-1, 1]) {
    const gz = side * (fieldD / 2);
    const postH = 2.2;
    for (const side2 of [-1.2, 1.2]) {
      b.box(goalWhite, [side2, postH / 2, gz], [0.12, postH, 0.12]);
    }
    b.box(goalWhite, [0, postH, gz], [2.4, 0.12, 0.12]);
  }

  // A low fence around the whole pitch.
  const fenceH = 1.1;
  const fenceInset = 2;
  const outerW = fieldW + fenceInset * 2;
  const outerD = fieldD + fenceInset * 2;
  b.box(fenceGrey, [0, fenceH / 2, outerD / 2], [outerW, fenceH, 0.08]);
  b.box(fenceGrey, [0, fenceH / 2, -outerD / 2], [outerW, fenceH, 0.08]);
  b.box(fenceGrey, [outerW / 2, fenceH / 2, 0], [0.08, fenceH, outerD]);
  b.box(fenceGrey, [-outerW / 2, fenceH / 2, 0], [0.08, fenceH, outerD]);

  // A bench along one side, outside the fence.
  bench(b, 0, outerD / 2 + 0.5, Math.PI);
};

export const FILLER_BUILDERS: Record<"park" | "houses" | "shops" | "field", CellBuilder> = {
  park,
  houses,
  shops,
  field,
};
