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

const pathMaterial = standard("#b4aa91", { roughness: 1 });
const waterMaterial = standard("#4a9fc8", { roughness: 0.35, metalness: 0.05 });
const benchMaterial = standard(COLORS.wood);
const hedgeMaterial = standard("#3d6f43", { roughness: 1 });
const sandMaterial = standard("#d8c38f", { roughness: 1 });
const meadowMaterial = standard("#6c984b", { roughness: 1 });
const plazaMaterial = standard("#aaa28f", { roughness: 1 });
const leafMaterials = ["#35643b", "#4f7c45", "#6e8d49"].map((c) => standard(c, { roughness: 1 }));
const flowerMaterials = ["#d9b44a", "#b86d72", "#758eb3"].map((c) => standard(c, { roughness: 1 }));

// Low-poly planting geometry is shared by every park cell. StaticBuilder
// bakes it into the cell mesh, so the extra silhouettes add no draw calls.
const canopyGeometry = new THREE.DodecahedronGeometry(1, 0);

const brickReds = ["#a75845", "#b56850", "#914b3c"].map((c) => standard(c));
const brickTans = ["#b39a72", "#a88c62", "#c0a986"].map((c) => standard(c));
const houseWalls = [...brickReds, ...brickTans];
const roofDarks = ["#3d4648", "#554842"].map((c) => standard(c));

const shopFronts = ["#4c6b73", "#7a5a4a", "#5a6b4c", "#6a5a73"].map((c) => standard(c));
const awningColors = ["#a13c3c", "#3c7a6b", "#c48a2a"].map((c) => standard(c));

const fieldGreen = standard("#4a823f", { roughness: 1 });
const lineWhite = standard("#e8e8e0");
const goalWhite = standard("#dcdcd6");
const fenceGrey = standard("#5a5d61");

// A window with `emissive` is textured/glow-only for StaticBuilder's merge
// rules, so every glowing window in this module must share this one
// material or each becomes its own draw call.
const windowLight = standard("#2a2620", {
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

function deciduousTree(b: StaticBuilder, x: number, z: number, scale: number, leaf: THREE.Material) {
  b.cylinder(MATERIALS.trunk, [x, 1.25 * scale, z], [0.2 * scale, 2.5 * scale, 0.2 * scale]);
  b.add(canopyGeometry, leaf, [x, 3.35 * scale, z], [1.45 * scale, 1.65 * scale, 1.45 * scale]);
}

function parkTree(b: StaticBuilder, rand: () => number, x: number, z: number, scale = 1) {
  if (rand() < 0.22) pineTree(b, x, z, scale * 0.9);
  else deciduousTree(b, x, z, scale, pick(rand, leafMaterials));
}

function pathBetween(b: StaticBuilder, from: [number, number], to: [number, number], width = 2.2) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  b.box(
    pathMaterial,
    [(from[0] + to[0]) / 2, 0.02, (from[1] + to[1]) / 2],
    [width, 0.04, Math.hypot(dx, dz)],
    [0, Math.atan2(dx, dz), 0],
  );
}

function picnicTable(b: StaticBuilder, x: number, z: number, rotationY: number) {
  b.box(benchMaterial, [x, 0.72, z], [2.2, 0.12, 0.8], [0, rotationY, 0]);
  for (const side of [-1, 1]) {
    const ox = Math.sin(rotationY) * side * 0.9;
    const oz = Math.cos(rotationY) * side * 0.9;
    b.box(benchMaterial, [x + ox, 0.45, z + oz], [2.2, 0.1, 0.38], [0, rotationY, 0]);
  }
  for (const side of [-0.72, 0.72]) {
    b.box(
      MATERIALS.darkSteel,
      [x + Math.cos(rotationY) * side, 0.35, z - Math.sin(rotationY) * side],
      [0.08, 0.7, 0.08],
    );
  }
}

function flowerBed(b: StaticBuilder, x: number, z: number, radius: number, flower: THREE.Material) {
  b.cylinder(MATERIALS.curb, [x, 0.12, z], [radius, 0.24, radius]);
  b.cylinder(flower, [x, 0.2, z], [radius - 0.22, 0.18, radius - 0.22]);
}

// ---------- park ----------

const park: CellBuilder = (b, rand) => {
  b.box(MATERIALS.grass, [0, -0.05, 0], [CELL_HALF * 2, 0.1, CELL_HALF * 2]);
  const variant = Math.floor(rand() * 4);
  let reserved: (x: number, z: number) => boolean;

  if (variant === 0) {
    // Watertuin: a loose bank path, a bright pond and tree groups rather
    // than the former evenly scattered conifers.
    pathBetween(b, [-18, 7], [-7, 4]);
    pathBetween(b, [-7, 4], [3, 7]);
    pathBetween(b, [3, 7], [18, 2]);
    pathBetween(b, [3, 7], [7, 18]);
    b.cylinder(MATERIALS.curb, [-8, 0.11, -9], [5.7, 0.22, 4.5]);
    b.cylinder(waterMaterial, [-8, 0.02, -9], [5.3, 0.08, 4.1]);
    bench(b, -1, 4.7, 0.2);
    bench(b, 8, 4.7, -0.25);
    flowerBed(b, 11.5, -10, 2.2, flowerMaterials[2]);
    reserved = (x, z) => Math.hypot((x + 8) / 1.2, z + 9) < 7 || Math.abs(z - 6) < 3;
  } else if (variant === 1) {
    // Stadstuin: clipped hedges and four planted rooms around a small
    // central plaza make this read as designed public space.
    b.box(pathMaterial, [0, 0.02, 0], [CELL_HALF * 2 - 4, 0.04, 2.2]);
    b.box(pathMaterial, [0, 0.02, 0], [2.2, 0.04, CELL_HALF * 2 - 4]);
    b.cylinder(plazaMaterial, [0, 0.04, 0], [4.2, 0.08, 4.2]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.box(hedgeMaterial, [sx * 9, 0.48, sz * 9], [7, 0.95, 0.55], [0, sx * sz * 0.08, 0]);
        flowerBed(b, sx * 9, sz * 7, 1.7, flowerMaterials[(sx + sz + 4) % flowerMaterials.length]);
      }
    }
    bench(b, 5.6, 2, Math.PI / 2);
    bench(b, -5.6, -2, -Math.PI / 2);
    reserved = (x, z) => Math.abs(x) < 5 || Math.abs(z) < 4;
  } else if (variant === 2) {
    // Stadsweide: broad open grass, a faceted walking loop, picnic tables
    // and irregular wildflower islands.
    b.box(meadowMaterial, [0, 0.01, 0], [24, 0.02, 22]);
    const loop: [number, number][] = [
      [-15, -11],
      [-10, 13],
      [7, 15],
      [15, 5],
      [12, -13],
      [-15, -11],
    ];
    for (let i = 1; i < loop.length; i++) pathBetween(b, loop[i - 1], loop[i], 1.8);
    picnicTable(b, -3, -4, 0.3);
    picnicTable(b, 4, 2, -0.45);
    flowerBed(b, -8, 6, 1.6, flowerMaterials[0]);
    flowerBed(b, 8, -6, 2, flowerMaterials[1]);
    reserved = (x, z) => Math.abs(x) < 8 && Math.abs(z) < 7;
  } else {
    // Buurtpark: a sandy play garden, pergola-like frame and a small orchard.
    pathBetween(b, [-18, -9], [-4, -3]);
    pathBetween(b, [-4, -3], [5, 7]);
    pathBetween(b, [5, 7], [18, 11]);
    b.cylinder(sandMaterial, [-8, 0.06, -7], [5.2, 0.12, 4.4]);
    for (const x of [-10, -7, -4]) {
      b.box(MATERIALS.darkSteel, [x, 1.4, -7], [0.12, 2.8, 0.12]);
    }
    b.box(MATERIALS.darkSteel, [-7, 2.75, -7], [6.2, 0.12, 0.12]);
    b.box(benchMaterial, [-7, 0.8, -7], [2.8, 1.6, 1.2], [0, 0, -0.2]);
    bench(b, 3, 8.4, 0.35);
    flowerBed(b, 10, -10, 2.1, flowerMaterials[1]);
    reserved = (x, z) => Math.hypot((x + 8) / 1.15, z + 7) < 6 || Math.abs(z - x * 0.55 - 4) < 3;
  }

  // A bounded number of seeded attempts gives every cell its own silhouette
  // while keeping the vertex budget predictable. Failed attempts simply
  // preserve useful clearings around paths and amenities.
  const attempts = variant === 2 ? 13 : 16;
  for (let i = 0; i < attempts; i++) {
    const x = (rand() - 0.5) * 32;
    const z = (rand() - 0.5) * 32;
    if (reserved(x, z)) continue;
    parkTree(b, rand, x, z, 0.72 + rand() * 0.32);
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
      // Three.js' positive x rotation slopes local +z downward. The north
      // panel therefore needs the positive angle and the south panel the
      // negative one, so both rise toward the central ridge rather than
      // opening outward like detached awnings.
      b.box(roofColor, [x, height + roofRise / 2, z - halfDepth / 2 + 0.05], [houseWidth, 0.25, slope], [-angle, 0, 0]);
      b.box(roofColor, [x, height + roofRise / 2, z + halfDepth / 2 - 0.05], [houseWidth, 0.25, slope], [angle, 0, 0]);

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
