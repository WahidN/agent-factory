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

const brickChurch = standard("#865043");
const brickTower = standard("#9b5d4c");
const brickStation = standard("#8f493a");
const roofDark = standard("#35444a");
const copperRoof = standard("#3f756e", { roughness: 0.72, metalness: 0.08 });
const windowDark = standard("#252e33", { roughness: 0.35 });
const plaza = standard("#b7b0a3");
const plazaBrick = standard("#9d735d");
const fieldGreen = standard("#4b843f");
const lineWhite = standard("#dedad0");
const necRed = standard("#b62f32");
const necBlack = standard("#25272a");
const stone = standard("#c5bcaa");
const bronze = standard("#5c6652", { roughness: 0.65, metalness: 0.2 });
const stationGlass = standard("#7293a0", { roughness: 0.25, metalness: 0.08 });
const awningRed = standard("#9c3a34");
const awningCream = standard("#cfc6a8");
const water = standard("#4298bf", { roughness: 0.3, metalness: 0.05 });

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
  const towerHeight = 25 + rand() * 2;
  const towerZ = -8;

  // The square west tower and its green, layered Renaissance crown are the
  // church's skyline signature. The slimmer belfry keeps that silhouette
  // legible from every map angle without a high-poly bespoke mesh.
  b.box(brickChurch, [0, towerHeight / 2, towerZ], [8.2, towerHeight, 8.2]);
  b.box(stone, [0, 7.5, towerZ + 4.12], [1.4, 3.8, 0.12]);
  b.box(windowDark, [0, towerHeight - 3, towerZ + 4.13], [1.5, 3.6, 0.1]);
  b.box(windowDark, [4.13, towerHeight - 3, towerZ], [0.1, 3.6, 1.5]);
  b.box(stone, [0, towerHeight + 0.45, towerZ], [9, 0.9, 9]);
  b.cylinder(copperRoof, [0, towerHeight + 2.2, towerZ], [4.1, 3.5, 4.1]);
  b.cone(copperRoof, [0, towerHeight + 5.4, towerZ], [3.4, 3.2, 3.4]);
  b.cylinder(copperRoof, [0, towerHeight + 7.4, towerZ], [1.1, 1.3, 1.1]);
  b.cone(copperRoof, [0, towerHeight + 9.6, towerZ], [1.35, 3.2, 1.35]);
  b.box(MATERIALS.darkSteel, [0, towerHeight + 11.7, towerZ], [0.14, 1.4, 0.14]);

  // Nave with a saddle roof, steunberen along both long walls.
  const naveHalfWidth = 4.5;
  const naveWallTop = 9;
  const naveZ = 3;
  const naveLength = 14;
  b.box(brickChurch, [0, naveWallTop / 2, naveZ], [naveHalfWidth * 2, naveWallTop, naveLength]);
  gableRoof(b, roofDark, 0, naveWallTop, naveZ, naveHalfWidth, 3.4, naveLength);

  // Broad transept and polygonal choir make the ground plan read as a Gothic
  // church instead of a hall behind a tower.
  b.box(brickChurch, [0, 5, 4.5], [14, 10, 5]);
  gableRoof(b, roofDark, 0, 10, 4.5, 7, 3.1, 5);
  b.cylinder(brickChurch, [0, 4.5, 10], [4.4, 9, 4.4]);
  b.cone(roofDark, [0, 10.7, 10], [4.7, 3.4, 4.7]);

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
  // Park draws one grass plane at y = 0 over the whole scene, so the field
  // sits just above it and the tribunes rising around it suggest the bowl.
  const fieldY = 0.05;
  const rimY = 2.4;

  b.box(fieldGreen, [0, fieldY, 0], [fieldHalfX * 2, 0.1, fieldHalfZ * 2]);
  b.box(lineWhite, [0, fieldY + 0.06, 0], [fieldHalfX * 2, 0.02, 0.15]);
  b.box(lineWhite, [0, fieldY + 0.06, -fieldHalfZ + 0.1], [fieldHalfX * 2, 0.02, 0.15]);
  b.box(lineWhite, [0, fieldY + 0.06, fieldHalfZ - 0.1], [fieldHalfX * 2, 0.02, 0.15]);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.box(lineWhite, [Math.cos(a) * 3, fieldY + 0.06, Math.sin(a) * 3], [0.15, 0.02, 0.15]);
  }

  // Flat tribunes on all four sides, raked from the field edge up to the rim.
  // The long dimension runs along the slope, so the x-rotation (north/south)
  // or z-rotation (east/west) tilts it from fieldY to rimY over depth.
  const depth = 6;
  const northSouthWidth = fieldHalfX * 2 + 4;
  const eastWestWidth = fieldHalfZ * 2 + 4;
  const rise = rimY - fieldY;
  const slopeLength = Math.hypot(depth, rise);
  const angle = Math.atan2(rise, depth);
  // Lift the slab by half its thickness so its lower corner rests on grade
  // instead of poking under the grass plane.
  const midY = (fieldY + rimY) / 2 + 0.3 * Math.cos(angle);

  b.box(MATERIALS.concrete, [0, midY, -fieldHalfZ - depth / 2], [northSouthWidth, 0.6, slopeLength], [angle, 0, 0]);
  b.box(MATERIALS.concrete, [0, midY, fieldHalfZ + depth / 2], [northSouthWidth, 0.6, slopeLength], [-angle, 0, 0]);
  b.box(MATERIALS.concrete, [-fieldHalfX - depth / 2, midY, 0], [slopeLength, 0.6, eastWestWidth], [0, 0, -angle]);
  b.box(MATERIALS.concrete, [fieldHalfX + depth / 2, midY, 0], [slopeLength, 0.6, eastWestWidth], [0, 0, angle]);

  // The NEC identity comes from its red-black seating bowl and bright white
  // roofs over the long stands. These are broad color blocks rather than
  // individual seats, so the extra detail remains one baked mesh.
  b.box(
    necRed,
    [0, midY + 0.35, -fieldHalfZ - depth / 2 + 0.3],
    [northSouthWidth - 1, 0.18, slopeLength - 0.5],
    [angle, 0, 0],
  );
  b.box(
    necRed,
    [0, midY + 0.35, fieldHalfZ + depth / 2 - 0.3],
    [northSouthWidth - 1, 0.18, slopeLength - 0.5],
    [-angle, 0, 0],
  );
  b.box(necBlack, [0, rimY + 0.25, -fieldHalfZ - depth + 0.3], [northSouthWidth - 1, 0.3, 0.7]);
  b.box(necBlack, [0, rimY + 0.25, fieldHalfZ + depth - 0.3], [northSouthWidth - 1, 0.3, 0.7]);
  b.box(lineWhite, [0, 5.1, -fieldHalfZ - depth + 0.2], [northSouthWidth + 1.5, 0.45, 4], [-0.08, 0, 0]);
  b.box(lineWhite, [0, 5.1, fieldHalfZ + depth - 0.2], [northSouthWidth + 1.5, 0.45, 4], [0.08, 0, 0]);
  for (const x of [-7, 0, 7]) {
    b.box(MATERIALS.steel, [x, 3.8, -fieldHalfZ - depth + 0.2], [0.22, 3.2, 0.22]);
    b.box(MATERIALS.steel, [x, 3.8, fieldHalfZ + depth - 0.2], [0.22, 3.2, 0.22]);
  }

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
  // Warm brick and pale-stone bands echo the rebuilt, enclosed city square.
  const strips = 16;
  for (let i = 0; i < strips; i++) {
    const x = -15 + i * 2;
    b.box(i % 2 === 0 ? plazaBrick : plaza, [x, 0.02, 0], [1.9, 0.04, 30]);
  }

  // The lowered entrance to the underground bicycle parking is the strongest
  // contemporary feature: a long glazed opening with stairs and a red rim.
  b.box(windowDark, [-2, 0.08, 2], [13, 0.12, 5]);
  for (let i = 0; i < 5; i++) {
    b.box(plaza, [-5 + i * 1.25, 0.2 + i * 0.14, 2], [1.15, 0.12, 4.2]);
  }
  b.box(necRed, [-2, 1.25, -0.4], [14, 0.35, 0.35]);
  b.box(stationGlass, [-2, 0.7, -0.15], [14, 1.1, 0.12]);

  // A compact post-war edge block and its vertical accent make the square
  // read as Plein 1944 instead of an open market field.
  b.box(brickStation, [-12.8, 4.2, 0], [3.5, 8.4, 24]);
  for (const z of [-8, -3, 2, 7]) {
    b.box(windowDark, [-11.02, 4.7, z], [0.1, 2.2, 2.4]);
  }
  b.box(brickStation, [-10.5, 9, -9], [4, 18, 4]);
  b.box(bronze, [-8.45, 8.4, -9], [0.1, 2.6, 1.6]);

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
  b.cylinder(stone, [towerX, towerHeight - 1.2, towerZ], [towerRadius + 0.18, 0.5, towerRadius + 0.18]);

  // Narrow red-black shutters are a conspicuous feature of the Kruittoren.
  for (const y of [4.2, 8.2, 11.5]) {
    b.box(windowDark, [towerX, y, towerZ - towerRadius - 0.03], [0.75, 1.5, 0.08]);
    b.box(awningRed, [towerX + towerRadius + 0.03, y, towerZ], [0.08, 1.5, 0.75]);
  }

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

  // A crenellated stretch of the old city wall and the moat link the tower
  // visually to the preserved medieval fortifications.
  b.box(brickTower, [towerX + towerRadius + 3, 3, towerZ + 2], [6, 6, 1.2]);
  for (let x = towerX + towerRadius + 0.8; x < 17; x += 1.8) {
    b.box(brickTower, [x, 6.5, towerZ + 2], [0.9, 1, 1.3]);
  }

  // A small pond.
  b.cylinder(water, [-6, 0.05, -5], [4, 0.1, 3]);
  b.box(MATERIALS.wood, [-1.7, 0.55, -5], [4.5, 0.35, 1.4]);
  for (const x of [-3.4, 0]) b.box(MATERIALS.darkSteel, [x, 0.85, -5], [0.08, 1, 1.2]);

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

  // The broad glazed entrance is framed by the dark-red Van Ravesteijn facade.
  const windows = 7;
  for (let i = 0; i < windows; i++) {
    const x = -hallHalfWidth + 2 + i * ((hallHalfWidth * 2 - 4) / (windows - 1));
    b.box(glow, [x, 3.2, hallZ + hallDepth / 2 + 0.05], [1.6, 2.4, 0.1]);
  }
  b.box(stationGlass, [4.5, 3.4, hallZ + hallDepth / 2 + 0.08], [7, 4.6, 0.12]);
  b.box(stone, [4.5, 6.25, hallZ + hallDepth / 2 + 0.12], [8, 0.5, 0.18]);

  // Colonnade in front, with a flat canopy.
  const pillars = 9;
  const colonnadeZ = hallZ + hallDepth / 2 + 2.5;
  for (let i = 0; i < pillars; i++) {
    const x = -12 + i * 3;
    b.cylinder(MATERIALS.concrete, [x, 2.5, colonnadeZ], [0.35, 5, 0.35]);
  }
  b.box(roofDark, [0, 5.2, colonnadeZ], [27, 0.4, 4]);

  // The offset square clock tower and open lantern are the station's most
  // recognizable silhouette; the real tower has a shallow cap, not a spire.
  const towerX = -hallHalfWidth - 2;
  const towerHeight = 18;
  b.box(brickStation, [towerX, towerHeight / 2, hallZ], [2.6, towerHeight, 2.6]);
  b.box(stone, [towerX, towerHeight + 0.35, hallZ], [3.2, 0.7, 3.2]);
  b.box(roofDark, [towerX, towerHeight + 1, hallZ], [2.4, 0.6, 2.4]);
  b.cylinder(stone, [towerX, towerHeight * 0.72, hallZ + 1.31], [0.9, 0.15, 0.9], [Math.PI / 2, 0, 0]);
  b.cylinder(stone, [towerX + 1.31, towerHeight * 0.72, hallZ], [0.9, 0.15, 0.9], [0, 0, Math.PI / 2]);
  b.box(MATERIALS.darkSteel, [towerX, towerHeight * 0.72, hallZ + 1.43], [0.08, 0.65, 0.08], [0, 0, 0.55]);

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
