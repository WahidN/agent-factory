// Leafy plants for the office: folded, drooping leaves with a drawn leaf
// texture, three kinds, three greens. Leaves are real geometry, not alpha
// cards, so the ambient occlusion pass sees their true outline.

import * as THREE from "three";
import { canvasTexture, standard } from "./palette.ts";
import type { StaticBuilder } from "./static-builder.ts";

const SEGMENTS = 6;

function leafTexture() {
  return canvasTexture(64, 256, (ctx) => {
    const fill = ctx.createLinearGradient(0, 256, 0, 0);
    fill.addColorStop(0, "#2c5a2b");
    fill.addColorStop(1, "#5f9a45");
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 64, 256);
    ctx.strokeStyle = "rgba(220, 240, 190, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(32, 256);
    ctx.lineTo(32, 6);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(220, 240, 190, 0.3)";
    for (let y = 230; y > 30; y -= 22) {
      ctx.beginPath();
      ctx.moveTo(32, y);
      ctx.lineTo(4, y - 34);
      ctx.moveTo(32, y);
      ctx.lineTo(60, y - 34);
      ctx.stroke();
    }
  });
}

// Length along +y from 0 to 1, width along x, and z for the fold and the droop.
function leafGeometry() {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const half = 0.5 * Math.sin(Math.PI * Math.min(1, t ** 0.7)) ** 0.8;
    const droop = t * t * 0.25;
    for (const side of [-1, 0, 1]) {
      const fold = side === 0 ? 0 : 0.18 * half;
      positions.push(side * half, t, droop + fold);
      uvs.push(0.5 + side * 0.5, t);
    }
    if (i === SEGMENTS) break;
    const row = i * 3;
    for (const column of [0, 1]) {
      const a = row + column;
      indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const map = leafTexture();
const leafMaterials = ["#ffffff", "#d5e6a8", "#a9cc92"].map((tint) =>
  standard(tint, { map, side: THREE.DoubleSide, roughness: 0.6 }),
);
const leaf = leafGeometry();
const stem = standard("#4a5a2e", { roughness: 0.9 });
const soil = standard("#3b2c20", { roughness: 1 });

type Kind = { leaves: number; width: number; length: number; pitch: [number, number]; rise: number };

export const KINDS: Record<string, Kind> = {
  rubber: { leaves: 14, width: 0.3, length: 0.52, pitch: [0.4, 1.05], rise: 0.45 },
  fern: { leaves: 22, width: 0.1, length: 0.8, pitch: [0.1, 0.6], rise: 0.05 },
  bushy: { leaves: 18, width: 0.18, length: 0.42, pitch: [0.8, 1.35], rise: 0.15 },
};

function seeded(seed: number) {
  let state = seed * 2654435761;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const up = new THREE.Vector3(0, 1, 0);
const right = new THREE.Vector3(1, 0, 0);
const pitchTurn = new THREE.Quaternion();
const yawTurn = new THREE.Quaternion();

export function addPlant(b: StaticBuilder, base: [number, number, number], kind: Kind, seed: number, scale = 1) {
  const next = seeded(seed + 1);
  const [x, y, z] = base;
  if (kind.rise > 0.1) b.cylinder(stem, [x, y + (kind.rise * scale) / 2, z], [0.02, kind.rise * scale, 0.02]);
  for (let i = 0; i < kind.leaves; i++) {
    const height = (i / kind.leaves) * kind.rise * scale;
    const pitch = kind.pitch[0] + next() * (kind.pitch[1] - kind.pitch[0]);
    const size = (0.8 + next() * 0.4) * scale;
    // The golden angle spreads the leaves round the stem without gaps.
    const quaternion = yawTurn
      .setFromAxisAngle(up, i * 2.399963 + next() * 0.4)
      .multiply(pitchTurn.setFromAxisAngle(right, pitch));
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y + height, z),
      quaternion,
      new THREE.Vector3(kind.width * size, kind.length * size, 1),
    );
    b.addWithMatrix(leaf, leafMaterials[i % leafMaterials.length], matrix);
  }
}

export function addSoil(b: StaticBuilder, at: [number, number, number], size: [number, number, number]) {
  b.box(soil, at, size);
}
