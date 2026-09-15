// Colors, shared materials, and canvas textures for the industrial park look.

import * as THREE from "three";
import { accentIndexFor } from "./park-layout.ts";

export const COLORS = {
  grass: "#1a1e25",
  road: "#5d6064",
  yard: "#7c7f83",
  wall: "#a3a6aa",
  roof: "#6f7276",
  parapet: "#8d9094",
  frame: "#e9edf0",
  glass: "#9fb7c6",
  yellow: "#f2c230",
  pineDark: "#2f7d4a",
  pineLight: "#3f9a57",
  rim: "#e2702f",
  band: "#d23c35",
  concrete: "#c9c7c0",
  steel: "#b9bdc1",
  darkSteel: "#4b4f55",
  wood: "#b68a57",
  cab: "#c8372d",
  trailer: "#e3e6e9",
  tire: "#2b2b2e",
  curb: "#d9d9d4",
  windowLight: "#ffe2a8",
};

// Fixed, readable accents: orange, red, teal, blue, yellow, green, purple, brown.
export const ACCENTS = ["#e2702f", "#d23c35", "#2a9d8f", "#3a6ea5", "#e9b43a", "#4c9a4a", "#7d5ba6", "#8a5a3c"];

export function accentFor(folder: string) {
  return new THREE.Color(ACCENTS[accentIndexFor(folder)]);
}

export function standard(color: string | THREE.Color, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
}

export const MATERIALS = {
  grass: standard(COLORS.grass, { roughness: 1 }),
  yard: standard(COLORS.yard, { roughness: 0.95 }),
  roof: standard(COLORS.roof),
  parapet: standard(COLORS.parapet),
  frame: standard(COLORS.frame),
  concrete: standard(COLORS.concrete),
  steel: standard(COLORS.steel, { roughness: 0.6, metalness: 0.2 }),
  darkSteel: standard(COLORS.darkSteel, { roughness: 0.7 }),
  yellow: standard(COLORS.yellow),
  pineDark: standard(COLORS.pineDark, { roughness: 0.9 }),
  pineLight: standard(COLORS.pineLight, { roughness: 0.9 }),
  trunk: standard("#6b4b33"),
  wood: standard(COLORS.wood),
  cab: standard(COLORS.cab, { roughness: 0.5 }),
  trailer: standard(COLORS.trailer, { roughness: 0.6 }),
  tire: standard(COLORS.tire),
  glass: standard(COLORS.glass, { roughness: 0.3, metalness: 0.1 }),
  curb: standard(COLORS.curb),
  band: standard(COLORS.band),
  tower: standard("#d8d8d4"),
  white: standard("#f4f4f2"),
  smoke: standard("#f2f2f0", { transparent: true, opacity: 0.8, depthWrite: false }),
  steam: standard("#ffffff", { transparent: true, opacity: 0.75, depthWrite: false }),
  lampHead: standard("#fff4d6", { emissive: "#fff1c9", emissiveIntensity: 0.6 }),
};

// ---------- Canvas textures ----------

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, color = true) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

// One wall bay: 3.5 wide, 6 tall. A tall window with mullions.
export const WALL_BAY = { width: 3.5, height: 6 };
const BAY_PX = { w: 140, h: 240 };
const WINDOW = { x: 26, y: 34, w: 88, h: 170, cols: 3, rows: 5 };

function drawPanes(ctx: CanvasRenderingContext2D, fill: string) {
  const { x, y, w, h, cols, rows } = WINDOW;
  const frame = 5;
  const paneW = (w - frame * (cols + 1)) / cols;
  const paneH = (h - frame * (rows + 1)) / rows;
  ctx.fillStyle = fill;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      ctx.fillRect(x + frame + c * (paneW + frame), y + frame + r * (paneH + frame), paneW, paneH);
    }
  }
}

export const TEXTURES = {
  // White where glass is, so only panes glow.
  wallBayGlow: canvasTexture(BAY_PX.w, BAY_PX.h, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, BAY_PX.w, BAY_PX.h);
    drawPanes(ctx, "#fff");
  }),

  // Road across 10 units (u), 8 units per repeat along its length (v).
  road: canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    ctx.fillStyle = "#eeeeea";
    ctx.fillRect(62, 0, 4, 64); // dashed center line
    ctx.fillRect(4, 0, 2, 128); // edge lines
    ctx.fillRect(122, 0, 2, 128);
  }),

  hatch: canvasTexture(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 122, 122);
    ctx.lineWidth = 7;
    for (let i = -128; i < 256; i += 26) {
      ctx.beginPath();
      ctx.moveTo(i, 128);
      ctx.lineTo(i + 128, 0);
      ctx.stroke();
    }
  }),

  lightPool: canvasTexture(128, 128, (ctx) => {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,244,214,0.9)");
    gradient.addColorStop(0.6, "rgba(255,244,214,0.35)");
    gradient.addColorStop(1, "rgba(255,244,214,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }),
};

export const DECALS = {
  hatch: new THREE.MeshBasicMaterial({ map: TEXTURES.hatch, transparent: true, depthWrite: false }),
  white: standard("#f1f1ec"),
  yellowLine: standard(COLORS.yellow),
};

// Roofs stay their own mesh so hovering a hall roof finds it.
MATERIALS.roof.userData.separate = true;

// Hall colors per machine. These are the brickwork itself, not a tint laid
// over it, so the windows keep their own color whichever hall they sit in.
export const WALL_TINTS = [
  "#8a95a3", // slate blue
  "#a08b83", // brick grey
  "#ab9f7e", // sand
  "#8b9c8a", // moss grey
  "#9a8a97", // plum grey
  "#7f8890", // slate
];

// One wallBay texture per tint, cached so the 14 lots of one machine (same
// tint) share a single texture instead of drawing a copy each. Never
// disposed by a lot: only the material built from it is.
const wallBayCache = new Map<string, THREE.Texture>();

export function wallBayFor(tint: string): THREE.Texture {
  const cached = wallBayCache.get(tint);
  if (cached) return cached;
  const texture = canvasTexture(BAY_PX.w, BAY_PX.h, (ctx) => {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, BAY_PX.w, BAY_PX.h);
    ctx.fillStyle = "rgba(0,0,0,0.05)"; // faint panel seam
    ctx.fillRect(0, 0, 2, BAY_PX.h);
    ctx.fillStyle = COLORS.frame;
    ctx.fillRect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);
    drawPanes(ctx, COLORS.glass);
    ctx.fillStyle = "#c6c9cc"; // sill
    ctx.fillRect(WINDOW.x - 4, WINDOW.y + WINDOW.h, WINDOW.w + 8, 6);
  });
  wallBayCache.set(tint, texture);
  return texture;
}

// Per lot, because window glow changes per session. Textures stay shared.
// The tint is baked into the brick fill of the texture itself, not into
// material.color, so it never multiplies over the frame, glass, or sill.
export function createWallMaterial(tint: string = COLORS.wall) {
  return standard("#ffffff", {
    map: wallBayFor(tint),
    emissiveMap: TEXTURES.wallBayGlow,
    emissive: COLORS.windowLight,
    emissiveIntensity: 0,
  });
}

// Scales a geometry's UVs so a repeating texture keeps real-world size.
export function repeatUv(geometry: THREE.BufferGeometry, u: number, v: number) {
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  uv.needsUpdate = true;
  return geometry;
}
