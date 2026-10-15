// Appliances and office equipment for the office floor. Each one is drawn
// into the office's own builder at a spot, so it merges into the meshes the
// room already has. office.ts decides where they stand and adds the blockers.
//
// Everything faces +z, toward the door, unless its comment says otherwise.

import { MATERIALS, standard } from "./palette.ts";
import type { StaticBuilder, Vec3 } from "./static-builder.ts";

const plastic = standard("#26282c", { roughness: 0.6 });
const screenOff = standard("#14171b", { roughness: 0.25 });
const printerWhite = standard("#e6e6e2", { roughness: 0.6 });
const boardWhite = standard("#fbfbf8", { roughness: 0.35 });
const red = standard("#c8372d");
const blue = standard("#2a5db0");

// ---------- Kitchen, standing on the counter at height y ----------

export function addEspressoMachine(b: StaticBuilder, [x, y, z]: Vec3) {
  b.box(MATERIALS.steel, [x, y + 0.18, z], [0.42, 0.36, 0.4]);
  b.box(plastic, [x, y + 0.31, z + 0.205], [0.38, 0.08, 0.01]);
  b.cylinder(MATERIALS.glass, [x + 0.12, y + 0.43, z - 0.06], [0.07, 0.14, 0.07]); // bean hopper
  b.cylinder(MATERIALS.darkSteel, [x - 0.06, y + 0.22, z + 0.22], [0.05, 0.05, 0.05]);
  b.box(plastic, [x - 0.06, y + 0.2, z + 0.31], [0.03, 0.03, 0.14]); // portafilter handle
  b.cylinder(MATERIALS.steel, [x + 0.13, y + 0.19, z + 0.23], [0.01, 0.16, 0.01]); // steam wand
  b.box(MATERIALS.steel, [x, y + 0.015, z + 0.26], [0.36, 0.03, 0.12]); // drip tray
  b.cylinder(MATERIALS.white, [x - 0.06, y + 0.065, z + 0.25], [0.035, 0.07, 0.035]);
}

export function addKettle(b: StaticBuilder, [x, y, z]: Vec3) {
  b.cylinder(plastic, [x, y + 0.01, z], [0.1, 0.02, 0.1]);
  b.cylinder(MATERIALS.white, [x, y + 0.12, z], [0.085, 0.2, 0.085]);
  b.cylinder(plastic, [x, y + 0.23, z], [0.06, 0.02, 0.06]);
  b.box(plastic, [x - 0.11, y + 0.13, z], [0.03, 0.16, 0.04]);
  b.box(MATERIALS.white, [x + 0.09, y + 0.17, z], [0.05, 0.04, 0.04]); // spout
}

export function addToaster(b: StaticBuilder, [x, y, z]: Vec3) {
  b.box(MATERIALS.steel, [x, y + 0.09, z], [0.28, 0.18, 0.16]);
  for (const dz of [-0.035, 0.035]) b.box(plastic, [x, y + 0.181, z + dz], [0.2, 0.01, 0.03]);
  b.box(plastic, [x + 0.09, y + 0.12, z + 0.09], [0.03, 0.02, 0.03]); // lever
}

// ---------- Kitchen, set into a cabinet front at z ----------

// Built into a tall cabinet: `[x, y]` is the middle of the door.
export function addMicrowave(b: StaticBuilder, [x, y, z]: Vec3) {
  b.box(MATERIALS.steel, [x, y, z + 0.01], [0.62, 0.4, 0.02]);
  b.box(screenOff, [x - 0.07, y, z + 0.025], [0.44, 0.3, 0.01]);
  b.box(MATERIALS.darkSteel, [x + 0.23, y, z + 0.025], [0.1, 0.3, 0.01]); // controls
  b.box(plastic, [x + 0.16, y, z + 0.045], [0.02, 0.24, 0.03]);
}

// Over one lower cabinet door, `width` wide, its own door handle covered.
export function addDishwasher(b: StaticBuilder, [x, y, z]: Vec3, width: number) {
  b.box(MATERIALS.steel, [x, y + 0.45, z + 0.03], [width - 0.04, 0.8, 0.04]);
  b.box(MATERIALS.darkSteel, [x, y + 0.82, z + 0.052], [width - 0.04, 0.05, 0.005]);
  b.box(MATERIALS.darkSteel, [x, y + 0.75, z + 0.065], [width - 0.2, 0.025, 0.03]);
}

// ---------- Office ----------

export function addKeyboardAndMouse(b: StaticBuilder, [x, y, z]: Vec3) {
  b.box(MATERIALS.darkSteel, [x, y + 0.01, z], [0.42, 0.02, 0.14]);
  b.box(MATERIALS.white, [x, y + 0.023, z + 0.005], [0.39, 0.006, 0.11]); // keys
  b.box(MATERIALS.darkSteel, [x + 0.3, y + 0.0125, z + 0.02], [0.06, 0.025, 0.1]);
}

// A screen on a floor stand, switched off.
export function addMeetingScreen(b: StaticBuilder, [x, y, z]: Vec3) {
  b.box(MATERIALS.darkSteel, [x, y + 0.025, z], [0.8, 0.05, 0.45]);
  b.box(MATERIALS.darkSteel, [x, y + 0.65, z], [0.08, 1.2, 0.08]);
  b.box(plastic, [x, y + 1.3, z + 0.07], [1.3, 0.76, 0.05]);
  b.box(screenOff, [x, y + 1.3, z + 0.1], [1.24, 0.7, 0.01]);
}

// A floor-standing printer facing +x: paper drawers, the print engine, the
// output tray in a dark recess with paper in it, and the scanner on top.
export function addPrinter(b: StaticBuilder, [x, y, z]: Vec3) {
  b.box(printerWhite, [x, y + 0.31, z], [0.62, 0.56, 0.56]);
  for (const dy of [0.2, 0.4]) {
    b.box(MATERIALS.darkSteel, [x + 0.31, y + dy, z], [0.01, 0.01, 0.5]);
    b.box(MATERIALS.darkSteel, [x + 0.315, y + dy + 0.08, z], [0.01, 0.02, 0.18]);
  }
  b.box(printerWhite, [x, y + 0.77, z], [0.62, 0.36, 0.56]);
  b.box(MATERIALS.darkSteel, [x - 0.06, y + 0.98, z], [0.5, 0.06, 0.5]);
  b.box(MATERIALS.white, [x + 0.05, y + 0.96, z], [0.3, 0.01, 0.21]); // printed pages
  b.box(printerWhite, [x, y + 1.06, z], [0.62, 0.1, 0.56]);
  b.box(MATERIALS.darkSteel, [x + 0.24, y + 1.13, z + 0.12], [0.14, 0.02, 0.24], [0, 0, -0.4]); // control panel
}

// A whiteboard on wheels facing +x, with a few marker lines on it.
export function addWhiteboard(b: StaticBuilder, [x, y, z]: Vec3) {
  for (const side of [-0.92, 0.92]) {
    b.box(MATERIALS.steel, [x, y + 0.95, z + side], [0.04, 1.75, 0.04]);
    b.box(MATERIALS.steel, [x, y + 0.08, z + side], [0.55, 0.04, 0.05]);
    for (const dx of [-0.24, 0.24]) {
      b.cylinder(plastic, [x + dx, y + 0.04, z + side], [0.04, 0.03, 0.04], [Math.PI / 2, 0, 0]);
    }
  }
  b.box(MATERIALS.steel, [x, y + 1.3, z], [0.04, 1.0, 1.8]);
  b.box(boardWhite, [x + 0.022, y + 1.3, z], [0.01, 0.94, 1.74]);
  b.box(MATERIALS.steel, [x + 0.05, y + 0.8, z], [0.08, 0.02, 0.8]); // marker tray
  for (const [i, marker] of [red, blue, plastic].entries()) {
    b.cylinder(marker, [x + 0.05, y + 0.82, z - 0.2 + i * 0.15], [0.01, 0.12, 0.01], [Math.PI / 2, 0, 0]);
  }

  const face = x + 0.029;
  b.box(blue, [face, y + 1.65, z - 0.45], [0.004, 0.025, 0.7]);
  for (const [i, length] of [0.6, 0.45, 0.55].entries()) {
    b.box(plastic, [face, y + 1.5 - i * 0.1, z - 0.75 + length / 2], [0.004, 0.012, length]);
  }
  for (const dy of [0.2, 0.5]) b.box(red, [face, y + 1.0 + dy, z + 0.45], [0.004, 0.012, 0.5]);
  for (const dz of [0.2, 0.7]) b.box(red, [face, y + 1.35, z + dz], [0.004, 0.3, 0.012]);
  b.box(red, [face, y + 1.2, z + 0.02], [0.004, 0.012, 0.3], [0.5, 0, 0]); // an arrow toward the box
}
