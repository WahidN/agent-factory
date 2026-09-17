// Five stylized Nijmegen landmarks, one per named city cell. Same contract as
// filler.ts and machines.ts: an origin at the cell's middle, y = 0 ground,
// +z north, everything inside CELL_HALF, and all geometry through the given
// StaticBuilder so it merges into a handful of draw calls.

import * as THREE from "three";
import type { CellBuilder } from "./cell-build.ts";
import { MATERIALS, standard } from "./palette.ts";
import type { StaticBuilder } from "./static-builder.ts";

// Unit cone (apex up, base radius 1 at y = -0.5), the same convention as the
// box and cylinder StaticBuilder already offers, for spires, roof caps and
// pointed-arch window tops.
const cone = new THREE.ConeGeometry(1, 1, 8);

// ---------- Shared materials ----------
// Brick gets its own color per landmark (still dark and desaturated to match
// the evening palette); everything else that repeats across landmarks shares
// one material so a landmark never buys its own draw calls for common parts.

const brickChurch = standard("#4a2620");
const brickTower = standard("#63332a");
const brickStation = standard("#57291f");
const roofDark = standard("#2e3138");
const plaza = standard("#8f8d86");
const fieldGreen = standard("#2c6238");
const lineWhite = standard("#dedad0");
const stone = standard("#9b978c");
const awningRed = standard("#9c3a34");
const awningCream = standard("#cfc6a8");
const water = standard("#1e2c34", { roughness: 0.25, metalness: 0.1 });

// Glowing windows and floodlights share the scene's existing lamp glow
// material instead of a bespoke emissive per landmark.
const glow = MATERIALS.lampHead;

// ---------- Small reusable pieces ----------

function tree(b: StaticBuilder, rand: () => number, [x, z]: [number, number]) {
  const height = 3 + rand() * 2;
  const canopy = 1 + rand() * 0.6;
  b.cylinder(MATERIALS.trunk, [x, height * 0.25, z], [0.15, height * 0.5, 0.15]);
  const leaf = rand() > 0.5 ? MATERIALS.pineDark : MATERIALS.pineLight;
  b.add(cone, leaf, [x, height * 0.5 + canopy * 0.6, z], [canopy, canopy * 1.6, canopy]);
}

function bench(b: StaticBuilder, [x, z]: [number, number], rotationY: number) {
  b.box(MATERIALS.wood, [x, 0.45, z], [1.6, 0.1, 0.5], [0, rotationY, 0]);
  b.box(MATERIALS.darkSteel, [x, 0.22, z], [1.5, 0.06, 0.45], [0, rotationY, 0]);
}

// A gabled roof panel pair over a hall running along z, ridge along z at x = centerX.
function gableRoof(
  b: StaticBuilder,
  material: THREE.Material,
  centerX: number,
  wallTopY: number,
  centerZ: number,
  halfWidth: number,
  rise: number,
  length: number,
  thickness = 0.4,
) {
  const slopeLength = Math.hypot(halfWidth, rise);
  const angle = Math.atan2(rise, halfWidth);
  const midY = wallTopY + rise / 2;
  b.box(material, [centerX + halfWidth / 2, midY, centerZ], [slopeLength, thickness, length], [0, 0, -angle]);
  b.box(material, [centerX - halfWidth / 2, midY, centerZ], [slopeLength, thickness, length], [0, 0, angle]);
}

// ---------- Grote of Sint-Stevenskerk ----------

function stevenskerk(b: StaticBuilder, rand: () => number) {
  const towerHeight = 30 + rand() * 4;
  const towerZ = -8;

  // Tower: tall, straight, flat-capped, clearly the highest of the five.
  b.box(brickChurch, [0, towerHeight / 2, towerZ], [8, towerHeight, 8]);
  b.box(roofDark, [0, towerHeight + 0.5, towerZ], [8.8, 1, 8.8]);
  b.cylinder(stone, [0, towerHeight * 0.72, towerZ + 4.01], [1.1, 0.15, 1.1], [Math.PI / 2, 0, 0]);

  // Nave with a saddle roof, steunberen along both long walls.
  const naveHalfWidth = 4.5;
  const naveWallTop = 9;
  const naveZ = 3;
  const naveLength = 14;
  b.box(brickChurch, [0, naveWallTop / 2, naveZ], [naveHalfWidth * 2, naveWallTop, naveLength]);
  gableRoof(b, roofDark, 0, naveWallTop, naveZ, naveHalfWidth, 3.4, naveLength);

  const buttresses = 5;
  for (let i = 0; i < buttresses; i++) {
    const z = naveZ - naveLength / 2 + 1.5 + i * (naveLength / (buttresses - 1)) * 0.92 + (rand() - 0.5) * 0.3;
    for (const side of [-1, 1] as const) {
      b.box(brickChurch, [side * (naveHalfWidth + 0.4), 3, z], [0.8, 6, 1.4]);
    }
  }

  // A row of narrow, pointed-arch windows on each long wall.
  const windows = 4;
  for (let i = 0; i < windows; i++) {
    const z = naveZ - naveLength / 2 + 2 + i * ((naveLength - 4) / (windows - 1));
    for (const side of [-1, 1] as const) {
      b.box(glow, [side * (naveHalfWidth + 0.02), 4, z], [0.9, 4, 0.1]);
      b.add(cone, brickChurch, [side * (naveHalfWidth + 0.05), 6.3, z], [0.5, 1, 0.1]);
    }
  }

  // A small pleintje in front, with a couple of trees.
  b.box(plaza, [0, 0.03, 14.5], [14, 0.06, 9]);
  const treeSpots: [number, number][] = [
    [-5.5, 12],
    [5.5, 13.5],
    [-4, 18],
  ];
  for (const spot of treeSpots) tree(b, rand, spot);
}

// ---------- Goffertstadion ----------

function goffert(b: StaticBuilder, rand: () => number) {
  const fieldHalfX = 8;
  const fieldHalfZ = 12;
  const fieldY = -1.3;
  const rimY = 0.6;

  b.box(fieldGreen, [0, fieldY, 0], [fieldHalfX * 2, 0.1, fieldHalfZ * 2]);
  b.box(lineWhite, [0, fieldY + 0.06, 0], [fieldHalfX * 2, 0.02, 0.15]);
  b.box(lineWhite, [0, fieldY + 0.06, -fieldHalfZ + 0.1], [fieldHalfX * 2, 0.02, 0.15]);
  b.box(lineWhite, [0, fieldY + 0.06, fieldHalfZ - 0.1], [fieldHalfX * 2, 0.02, 0.15]);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.box(lineWhite, [Math.cos(a) * 3, fieldY + 0.06, Math.sin(a) * 3], [0.15, 0.02, 0.15]);
  }

  // Flat tribunes on all four sides, raked from the sunken field up to grade.
  const depth = 6;
  const northSouthWidth = fieldHalfX * 2 + 4;
  const eastWestWidth = fieldHalfZ * 2 + 4;
  const rise = rimY - fieldY;
  const slopeLength = Math.hypot(depth, rise);
  const angle = Math.atan2(rise, depth);
  const midY = (fieldY + rimY) / 2;

  b.box(MATERIALS.concrete, [0, midY, -fieldHalfZ - depth / 2], [northSouthWidth, slopeLength, 0.6], [angle, 0, 0]);
  b.box(MATERIALS.concrete, [0, midY, fieldHalfZ + depth / 2], [northSouthWidth, slopeLength, 0.6], [-angle, 0, 0]);
  b.box(MATERIALS.concrete, [-fieldHalfX - depth / 2, midY, 0], [0.6, slopeLength, eastWestWidth], [0, 0, -angle]);
  b.box(MATERIALS.concrete, [fieldHalfX + depth / 2, midY, 0], [0.6, slopeLength, eastWestWidth], [0, 0, angle]);

  // Four floodlight masts, one per corner.
  const mastX = fieldHalfX + depth - 1;
  const mastZ = fieldHalfZ + depth - 1;
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      b.box(MATERIALS.steel, [sx * mastX, 7.5, sz * mastZ], [0.6, 15, 0.6]);
      b.box(glow, [sx * mastX, 15.2, sz * mastZ], [2.2, 0.6, 1.4]);
    }
  }

  // Goffertpark trees just outside the bowl.
  const treeCount = 6;
  for (let i = 0; i < treeCount; i++) {
    const a = (i / treeCount) * Math.PI * 2 + rand() * 0.3;
    const r = 17 + rand() * 1.5;
    tree(b, rand, [Math.cos(a) * r, Math.sin(a) * r]);
  }
}

// ---------- Plein 1944 ----------

function plein1944(b: StaticBuilder, rand: () => number) {
  // Paved plaza in alternating stone strips.
  const strips = 16;
  for (let i = 0; i < strips; i++) {
    const x = -15 + i * 2;
    b.box(i % 2 === 0 ? plaza : MATERIALS.curb, [x, 0.02, 0], [1.9, 0.04, 30]);
  }

  // A monument on a sokkel at the center.
  b.box(stone, [0, 1, 0], [3, 2, 3]);
  b.box(stone, [0, 5, 0], [1, 6, 1]);

  // Market stalls with striped awnings along the east edge.
  const stalls = 4;
  for (let i = 0; i < stalls; i++) {
    const z = -9 + i * 6;
    b.box(MATERIALS.wood, [13, 1, z], [3, 2, 4]);
    b.box(awningRed, [13, 2.3, z - 1], [3.4, 0.2, 2.2]);
    b.box(awningCream, [13, 2.3, z + 1], [3.4, 0.2, 2.2]);
  }

  // Benches and a few trees around the plaza.
  const benchSpots: [number, number][] = [
    [-10, -6],
    [-10, 6],
    [6, -13],
  ];
  for (const spot of benchSpots) bench(b, spot, rand() * Math.PI);
  const treeSpots: [number, number][] = [
    [-14, -14],
    [-14, 14],
    [14, -14],
  ];
  for (const spot of treeSpots) tree(b, rand, spot);
}

// ---------- Kronenburgerpark ----------

function kronenburgerpark(b: StaticBuilder, rand: () => number) {
  const towerX = 8;
  const towerZ = 8;
  const towerHeight = 14;
  const towerRadius = 3.2;

  b.cylinder(brickTower, [towerX, towerHeight / 2, towerZ], [towerRadius, towerHeight, towerRadius]);

  // Crenellations around the top rim.
  const merlons = 12;
  for (let i = 0; i < merlons; i += 2) {
    const a = (i / merlons) * Math.PI * 2;
    b.box(
      brickTower,
      [towerX + Math.cos(a) * towerRadius, towerHeight + 0.4, towerZ + Math.sin(a) * towerRadius],
      [0.8, 0.8, 0.8],
    );
  }

  // A short stretch of old city wall running off the tower, ending in nothing.
  b.box(brickTower, [towerX + towerRadius + 3, 3, towerZ + 2], [6, 6, 1.2]);

  // A small pond.
  b.cylinder(water, [-6, 0.05, -5], [4, 0.1, 3]);

  // Gravel paths radiating from near the tower.
  const paths = 3;
  for (let i = 0; i < paths; i++) {
    const angle = rand() * Math.PI * 2;
    b.box(MATERIALS.curb, [Math.cos(angle) * 6, 0.03, Math.sin(angle) * 6], [8, 0.05, 1.2], [0, angle, 0]);
  }

  // Park trees and a bench by the pond.
  bench(b, [-6, -8.5], 0);
  const treeCount = 5;
  for (let i = 0; i < treeCount; i++) {
    const a = (i / treeCount) * Math.PI * 2 + rand() * 0.4;
    const r = 12 + rand() * 4;
    tree(b, rand, [Math.cos(a) * r, Math.sin(a) * r]);
  }
}

// ---------- Station Nijmegen ----------

function station(b: StaticBuilder, rand: () => number) {
  const hallHalfWidth = 13;
  const hallDepth = 8;
  const hallHeight = 6;
  const hallZ = -6;

  b.box(brickStation, [0, hallHeight / 2, hallZ], [hallHalfWidth * 2, hallHeight, hallDepth]);
  b.box(roofDark, [0, hallHeight + 0.2, hallZ], [hallHalfWidth * 2 + 0.6, 0.4, hallDepth + 0.6]);

  // Windows along the entrance-facing wall.
  const windows = 7;
  for (let i = 0; i < windows; i++) {
    const x = -hallHalfWidth + 2 + i * ((hallHalfWidth * 2 - 4) / (windows - 1));
    b.box(glow, [x, 3.2, hallZ + hallDepth / 2 + 0.05], [1.6, 2.4, 0.1]);
  }

  // Colonnade in front, with a flat canopy.
  const pillars = 9;
  const colonnadeZ = hallZ + hallDepth / 2 + 2.5;
  for (let i = 0; i < pillars; i++) {
    const x = -12 + i * 3;
    b.cylinder(MATERIALS.concrete, [x, 2.5, colonnadeZ], [0.35, 5, 0.35]);
  }
  b.box(roofDark, [0, 5.2, colonnadeZ], [27, 0.4, 4]);

  // A slim, freestanding clock tower with a pointed top.
  const towerX = -hallHalfWidth - 2;
  const towerHeight = 18;
  b.box(brickStation, [towerX, towerHeight / 2, hallZ], [2.6, towerHeight, 2.6]);
  b.add(cone, roofDark, [towerX, towerHeight + 1, hallZ], [1.6, 2, 1.6]);
  b.cylinder(stone, [towerX, towerHeight * 0.7, hallZ + 1.31], [1, 0.15, 1], [Math.PI / 2, 0, 0]);

  // Platform and canopy on the far side, with a short stub of track.
  const platformZ = hallZ - hallDepth / 2 - 3;
  b.box(plaza, [0, 0.15, platformZ], [hallHalfWidth * 2, 0.3, 6]);
  b.box(roofDark, [0, 4.5, platformZ], [hallHalfWidth * 2 - 2, 0.3, 5]);
  const posts = 5;
  for (let i = 0; i < posts; i++) {
    const x = -10 + i * 5;
    b.cylinder(MATERIALS.steel, [x, 2.25, platformZ], [0.15, 4.5, 0.15]);
  }
  const trackZ = platformZ - 4;
  b.box(MATERIALS.darkSteel, [0, 0.1, trackZ - 0.8], [hallHalfWidth * 2 - 4, 0.1, 0.15]);
  b.box(MATERIALS.darkSteel, [0, 0.1, trackZ + 0.8], [hallHalfWidth * 2 - 4, 0.1, 0.15]);
  const sleepers = 8;
  for (let i = 0; i < sleepers; i++) {
    const x = -hallHalfWidth + 1 + i * ((hallHalfWidth * 2 - 2) / (sleepers - 1)) + (rand() - 0.5) * 0.2;
    b.box(MATERIALS.wood, [x, 0.06, trackZ], [0.3, 0.12, 2]);
  }
}

export const CITY_LANDMARKS: Record<
  "stevenskerk" | "goffert" | "plein1944" | "kronenburgerpark" | "station",
  CellBuilder
> = {
  stevenskerk,
  goffert,
  plein1944,
  kronenburgerpark,
  station,
};
