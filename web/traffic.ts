// Cars: parked ones in every yard, and moving ones on the lot's road loop
// while its session is busy.

import * as THREE from "three";
import { createTruck, YARD_Y } from "./machines.ts";
import { DECALS, standard } from "./palette.ts";
import { MAX_MOVING_CARS, movingCarCount, roadLoopPoint } from "./park-layout.ts";
import { BAKED_MATERIAL, StaticBuilder } from "./static-builder.ts";

export const CAR_COLORS = ["#c8372d", "#2f5d9e", "#f1f1ee", "#b9bdc1", "#e9b43a", "#2b2f36", "#3f8f6b"];

const box = new THREE.BoxGeometry(1, 1, 1);
const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 12).rotateX(Math.PI / 2);
const glassMaterial = standard("#34495e");
const tireMaterial = standard("#232326");
const trimMaterial = standard("#8e9297");
const headlightMaterial = standard("#f4f1e1");
const taillightMaterial = standard("#b02a22");

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material | "paint"; matrix: THREE.Matrix4 };

const at = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));

// A car facing +x, about 3.8 long and 1.7 wide. "paint" parts get the car color.
const CAR_PARTS: Part[] = [
  { geometry: box, material: "paint", matrix: at(0, 0.62, 0, 3.8, 0.62, 1.7) },
  { geometry: box, material: "paint", matrix: at(-0.25, 1.22, 0, 2.0, 0.62, 1.5) },
  { geometry: box, material: glassMaterial, matrix: at(-0.25, 1.2, 0, 2.06, 0.42, 1.54) },
  { geometry: box, material: trimMaterial, matrix: at(1.92, 0.5, 0, 0.1, 0.25, 1.6) },
  { geometry: box, material: trimMaterial, matrix: at(-1.92, 0.5, 0, 0.1, 0.25, 1.6) },
  { geometry: box, material: headlightMaterial, matrix: at(1.91, 0.78, 0.55, 0.06, 0.16, 0.35) },
  { geometry: box, material: headlightMaterial, matrix: at(1.91, 0.78, -0.55, 0.06, 0.16, 0.35) },
  { geometry: box, material: taillightMaterial, matrix: at(-1.91, 0.78, 0.6, 0.06, 0.16, 0.3) },
  { geometry: box, material: taillightMaterial, matrix: at(-1.91, 0.78, -0.6, 0.06, 0.16, 0.3) },
  ...[1.25, -1.25].flatMap((x) =>
    [0.78, -0.78].map((z): Part => ({ geometry: wheel, material: tireMaterial, matrix: at(x, 0.34, z) })),
  ),
];

// Geometry of all parts of one kind with baked colors, for instanced meshes.
function carGeometry(paint: boolean): THREE.BufferGeometry {
  const builder = new StaticBuilder();
  const white = standard("#ffffff");
  for (const part of CAR_PARTS) {
    if ((part.material === "paint") !== paint) continue;
    builder.addWithMatrix(part.geometry, part.material === "paint" ? white : part.material, part.matrix);
  }
  return (builder.build().children[0] as THREE.Mesh).geometry;
}

const carBodyGeometry = carGeometry(true); // white, tinted per instance
const carDetailGeometry = carGeometry(false);
const paints = CAR_COLORS.map((color) => standard(color));

function hash(text: string) {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}

// 3 cars parked nose to the hall, with white bay lines, merged into the lot's
// static mesh. Colors come from the session id, so they stay after a reload.
export function addParkedCars(builder: StaticBuilder, seed: string) {
  const h = hash(seed);
  const facingHall = new THREE.Matrix4().makeRotationY(Math.PI / 2); // +x becomes -z
  [1, 3.6, 6.2].forEach((x, i) => {
    const car = at(x, YARD_Y, 6).multiply(facingHall);
    const paint = paints[(h >>> (i * 3)) % paints.length]; // unsigned shift, so the index is never negative
    for (const part of CAR_PARTS) {
      builder.addWithMatrix(part.geometry, part.material === "paint" ? paint : part.material, car.clone().multiply(part.matrix));
    }
  });
  for (const x of [-0.3, 2.3, 4.9, 7.5]) {
    builder.add(new THREE.PlaneGeometry(0.12, 4.2), DECALS.white, [x, YARD_Y + 0.01, 6], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  }
}

// The truck plus up to 6 cars on the lot's road loop, evenly spaced so they
// never overlap. Two instanced meshes draw all the cars.
export class LotTraffic {
  readonly group = new THREE.Group();
  private truck = createTruck();
  private bodies = new THREE.InstancedMesh(carBodyGeometry, BAKED_MATERIAL, MAX_MOVING_CARS);
  private details = new THREE.InstancedMesh(carDetailGeometry, BAKED_MATERIAL, MAX_MOVING_CARS);
  private presence: number[] = new Array(MAX_MOVING_CARS).fill(0);
  private distance = Math.random() * 200;
  private matrix = new THREE.Matrix4();
  private quaternion = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(private loopHalf: number, seed: string) {
    const h = hash(seed);
    const color = new THREE.Color();
    for (let i = 0; i < MAX_MOVING_CARS; i++) {
      this.bodies.setColorAt(i, color.set(CAR_COLORS[(h + i * 5) % CAR_COLORS.length]));
    }
    for (const mesh of [this.bodies, this.details]) {
      mesh.frustumCulled = false; // cars drive far from the mesh origin
      mesh.castShadow = true;
    }
    this.truck.scale.setScalar(0.001);
    this.group.add(this.truck, this.bodies, this.details);
  }

  // `busy` is the lot's eased busy value; the car count uses the raw states.
  tick(dt: number, busy: number, lotBusy: boolean, busySubagents: number) {
    const target = movingCarCount(lotBusy, busySubagents);
    for (let i = 0; i < MAX_MOVING_CARS; i++) {
      const goal = i < target ? 1 : 0;
      const step = dt / 0.5;
      this.presence[i] = goal > this.presence[i] ? Math.min(1, this.presence[i] + step) : Math.max(0, this.presence[i] - step);
    }

    const moving = Math.max(busy, ...this.presence);
    this.distance += dt * 9 * (moving > 0 ? 1 : 0);
    const spacing = (this.loopHalf * 8) / (MAX_MOVING_CARS + 1);

    const truckPoint = roadLoopPoint(this.distance, this.loopHalf);
    this.truck.position.set(truckPoint.x, 0.05, truckPoint.z);
    this.truck.rotation.y = truckPoint.heading;
    this.truck.scale.setScalar(Math.max(0.001, busy));
    this.truck.visible = busy > 0.01;

    for (let i = 0; i < MAX_MOVING_CARS; i++) {
      const point = roadLoopPoint(this.distance + (i + 1) * spacing, this.loopHalf);
      this.quaternion.setFromAxisAngle(this.up, point.heading);
      const scale = this.presence[i];
      this.matrix.compose(new THREE.Vector3(point.x, 0.05, point.z), this.quaternion, new THREE.Vector3(scale, scale, scale));
      this.bodies.setMatrixAt(i, this.matrix);
      this.details.setMatrixAt(i, this.matrix);
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    this.details.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.bodies.dispose();
    this.details.dispose();
  }
}
