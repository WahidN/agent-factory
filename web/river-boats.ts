// Lightweight traffic for the Waal. Every visible boat is an instance of the
// same two meshes, so a wider city adds instances rather than draw calls.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { RiverBounds } from "./park.ts";
import { standard } from "./palette.ts";

const MAX_BOATS = 6;
const HULL_COLORS = ["#c94d3d", "#246d83", "#d39a35", "#55765a"];

const hullGeometry = mergeGeometries([
  new THREE.BoxGeometry(5.4, 0.7, 1.9).translate(0, 0.45, 0),
  new THREE.ConeGeometry(1.35, 2.4, 4).rotateZ(-Math.PI / 2).translate(3.8, 0.45, 0),
]);
const cabinGeometry = mergeGeometries([
  new THREE.BoxGeometry(2.2, 1.05, 1.5).translate(-0.6, 1.2, 0),
  new THREE.BoxGeometry(2.55, 0.16, 1.75).translate(-0.6, 1.82, 0),
]);

const hullMaterial = standard("#ffffff", { roughness: 0.62 });
const cabinMaterial = standard("#ece8d9", { roughness: 0.72 });

type Boat = { progress: number; direction: 1 | -1; speed: number; lane: number };

export class RiverBoats {
  readonly group = new THREE.Group();

  private readonly hulls = new THREE.InstancedMesh(hullGeometry, hullMaterial, MAX_BOATS);
  private readonly cabins = new THREE.InstancedMesh(cabinGeometry, cabinMaterial, MAX_BOATS);
  private readonly boats: Boat[] = [];
  private river: RiverBounds | null = null;
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly color = new THREE.Color();

  constructor() {
    for (let i = 0; i < MAX_BOATS; i++) this.hulls.setColorAt(i, this.color.set(HULL_COLORS[i % HULL_COLORS.length]));
    for (const mesh of [this.hulls, this.cabins]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    this.group.add(this.hulls, this.cabins);
  }

  setRiver(river: RiverBounds | null) {
    this.river = river;
    this.boats.length = 0;
    if (river) {
      const count = THREE.MathUtils.clamp(Math.floor((river.east - river.west) / 85), 2, MAX_BOATS);
      for (let i = 0; i < count; i++) {
        this.boats.push({
          progress: (i + 0.35) / count,
          direction: i % 2 === 0 ? 1 : -1,
          speed: 3.6 + (i % 3) * 0.55,
          lane: i % 2 === 0 ? -0.23 : 0.23,
        });
      }
    }
    this.draw();
  }

  tick(dt: number) {
    if (!this.river) return;
    const span = this.river.east - this.river.west;
    for (const boat of this.boats) {
      boat.progress = (boat.progress + (boat.direction * boat.speed * dt) / span + 1) % 1;
    }
    this.draw();
  }

  visibleCount() {
    return this.boats.length;
  }

  private draw() {
    const river = this.river;
    if (!river) {
      this.hulls.count = this.cabins.count = 0;
      return;
    }
    const span = river.east - river.west;
    for (let i = 0; i < this.boats.length; i++) {
      const boat = this.boats[i];
      this.quaternion.setFromAxisAngle(this.up, boat.direction === 1 ? 0 : Math.PI);
      this.matrix.compose(
        this.position.set(river.west + boat.progress * span, 0.08, river.z + boat.lane * river.width),
        this.quaternion,
        this.scale,
      );
      this.hulls.setMatrixAt(i, this.matrix);
      this.cabins.setMatrixAt(i, this.matrix);
    }
    this.hulls.count = this.cabins.count = this.boats.length;
    this.hulls.instanceMatrix.needsUpdate = true;
    this.cabins.instanceMatrix.needsUpdate = true;
    this.hulls.instanceColor!.needsUpdate = true;
  }
}
