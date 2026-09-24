// Colors, shared materials, and canvas textures for the industrial park look.

import * as THREE from "three";
import { INK_STYLE_ENABLED, inkStandardMaterial } from "./ink-style.ts";
import { accentIndexFor } from "./park-layout.ts";

const CLASSIC_COLORS = {
  grass: "#4f7b45",
  water: "#2793c2",
  road: "#555d61",
  yard: "#a6a39a",
  wall: "#c8c5ba",
  roof: "#58656b",
  parapet: "#748086",
  frame: "#eef1ed",
  glass: "#79aebe",
  yellow: "#f1bd35",
  pineDark: "#2d6642",
  pineLight: "#4f8b52",
  rim: "#e2702f",
  band: "#d23c35",
  concrete: "#d4d0c5",
  steel: "#c7ced0",
  darkSteel: "#3f4b50",
  wood: "#a97445",
  cab: "#c8372d",
  trailer: "#e3e6e9",
  tire: "#2b2b2e",
  curb: "#e2dfd5",
  windowLight: "#ffe2a8",
};

const INK_COLORS = {
  grass: "#3f6f62",
  water: "#367fa0",
  road: "#35384c",
  yard: "#888397",
  wall: "#c9bba6",
  roof: "#41405b",
  parapet: "#615d78",
  frame: "#f2e9d8",
  glass: "#65a7bc",
  yellow: "#f5c34b",
  pineDark: "#224e45",
  pineLight: "#3e7560",
  rim: "#f06b55",
  band: "#c94562",
  concrete: "#c9c0b1",
  steel: "#aeb7c4",
  darkSteel: "#34364b",
  wood: "#9b654d",
  cab: "#d94d4d",
  trailer: "#e9e0d2",
  tire: "#202033",
  curb: "#e7ddcd",
  windowLight: "#ffd37c",
};

export const COLORS = INK_STYLE_ENABLED ? INK_COLORS : CLASSIC_COLORS;

// Fixed, readable accents: orange, red, teal, blue, yellow, green, purple, brown.
export const ACCENTS = INK_STYLE_ENABLED
  ? ["#f06b55", "#d43f68", "#20a38f", "#448fd0", "#f5bd42", "#65a85e", "#8668bc", "#b06b55"]
  : ["#e36f32", "#cf4141", "#168f83", "#3478ad", "#e6aa2d", "#568f45", "#7659a6", "#9a613e"];

export function accentFor(folder: string) {
  return new THREE.Color(ACCENTS[accentIndexFor(folder)]);
}

export function standard(color: string | THREE.Color, extra: THREE.MeshStandardMaterialParameters = {}) {
  if (INK_STYLE_ENABLED) return inkStandardMaterial(color, extra);
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, flatShading: true, ...extra });
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
  // A tiny, deterministic meadow tile gives the enormous ground plane scale
  // without adding geometry, draw calls, or anything to the frame loop. The
  // grass and water keep repeat 1: their geometry sets the tiling in its UVs
  // (see park.ts), so every surface keeps the same world-size tile.
  grass: canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, 256, 256);
    const flecks = ["rgba(230,241,181,0.14)", "rgba(23,67,39,0.12)", "rgba(255,255,230,0.08)"];
    for (let i = 0; i < 420; i++) {
      const x = (i * 73 + ((i * i * 17) % 251)) % 256;
      const y = (i * 151 + ((i * i * 29) % 241)) % 256;
      ctx.fillStyle = flecks[i % flecks.length];
      ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, 2 + (i % 3));
    }
  }),

  // Broad horizontal bands read as a current from an isometric camera. This
  // remains one static texture on one river mesh, so blue water is virtually
  // free compared with a shader or animated normal map.
  water: canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = "#c0dfe7";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    for (let y = 0; y < 128; y += 16) ctx.fillRect(0, y, 256, 8);
    ctx.strokeStyle = "rgba(216,246,255,0.28)";
    ctx.lineWidth = 2;
    for (let y = 12; y < 128; y += 21) {
      ctx.beginPath();
      for (let x = -20; x <= 276; x += 16) {
        const waveY = y + Math.sin((x + y * 3) * 0.08) * 2;
        if (x === -20) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.stroke();
    }
  }),

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
export const WALL_TINTS = INK_STYLE_ENABLED
  ? ["#829caf", "#ad7f78", "#bda66c", "#779783", "#9d7f9d", "#777b91"]
  : ["#8fa7b7", "#b09284", "#b9a875", "#8fa58b", "#a690a4", "#89969f"];

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
