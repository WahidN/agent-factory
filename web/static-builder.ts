// Collects a lot's non-moving parts and merges them, so a detailed lot costs a
// handful of draw calls instead of hundreds.
//
// Plain colored materials are baked into vertex colors and share one material,
// so all of them merge into a single mesh. Materials with textures, glow,
// transparency, or `userData.separate` (animated or hoverable) keep their own mesh.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const box = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 16);
const euler = new THREE.Euler();
const quaternion = new THREE.Quaternion();

export type Vec3 = [number, number, number];

export const BAKED_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });

function isPlain(material: THREE.Material): material is THREE.MeshStandardMaterial {
  return (
    material instanceof THREE.MeshStandardMaterial &&
    !material.userData.separate &&
    !material.map &&
    !material.transparent &&
    material.side === THREE.FrontSide &&
    material.emissive.getHex() === 0 // a glow color means it may light up later
  );
}

// Normalizes a piece so every piece in a group has the same attributes.
function prepare(geometry: THREE.BufferGeometry, color: THREE.Color | null) {
  const piece = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(piece.attributes)) {
    if (!["position", "normal", "uv"].includes(name)) piece.deleteAttribute(name);
  }
  if (color) {
    const colors = new Float32Array(piece.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([color.r, color.g, color.b], i);
    piece.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  return piece;
}

export class StaticBuilder {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: Vec3,
    scale: Vec3 = [1, 1, 1],
    rotation: Vec3 = [0, 0, 0],
  ) {
    quaternion.setFromEuler(euler.set(...rotation));
    this.addWithMatrix(
      geometry,
      material,
      new THREE.Matrix4().compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale)),
    );
  }

  // For parts placed inside an already transformed object, like a parked car.
  addWithMatrix(geometry: THREE.BufferGeometry, material: THREE.Material, matrix: THREE.Matrix4) {
    const plain = isPlain(material);
    const piece = prepare(geometry, plain ? material.color : null).applyMatrix4(matrix);
    const target = plain ? BAKED_MATERIAL : material;
    const list = this.parts.get(target) ?? [];
    list.push(piece);
    this.parts.set(target, list);
  }

  box(material: THREE.Material, position: Vec3, scale: Vec3, rotation: Vec3 = [0, 0, 0]) {
    this.add(box, material, position, scale, rotation);
  }

  // Scale x and z are radii, y is height.
  cylinder(material: THREE.Material, position: Vec3, scale: Vec3, rotation: Vec3 = [0, 0, 0]) {
    this.add(cylinder, material, position, scale, rotation);
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    for (const [material, pieces] of this.parts) {
      const merged = mergeGeometries(pieces);
      for (const piece of pieces) piece.dispose();
      const mesh = new THREE.Mesh(merged, material);
      // A material can opt out of casting a shadow even when it is opaque:
      // see the Waal's water in park.ts for why.
      mesh.castShadow = !material.transparent && material.userData.castShadow !== false;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}
