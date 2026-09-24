// Cars: parked ones in every yard, and moving ones from every lot that drive
// all park roads, joined by the truck of each busy lot.

import * as THREE from "three";
import { createTruck, YARD_Y } from "./machines.ts";
import { DECALS, standard } from "./palette.ts";
import { MAX_MOVING_CARS } from "./park-layout.ts";
import { BAKED_MATERIAL, StaticBuilder } from "./static-builder.ts";
import {
  pickNext,
  roadGraph,
  spawnVehicle,
  stepVehicles,
  vehiclePose,
  type Roads,
  type Vehicle,
} from "./traffic-logic.ts";

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
const truckGeometry = (createTruck().children[0] as THREE.Mesh).geometry; // all truck parts are baked into one mesh
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
      builder.addWithMatrix(
        part.geometry,
        part.material === "paint" ? paint : part.material,
        car.clone().multiply(part.matrix),
      );
    }
  });
  for (const x of [-0.3, 2.3, 4.9, 7.5]) {
    builder.add(
      new THREE.PlaneGeometry(0.12, 4.2),
      DECALS.white,
      [x, YARD_Y + 0.01, 6],
      [1, 1, 1],
      [-Math.PI / 2, 0, 0],
    );
  }
}

const MAX_VEHICLES = 120; // for the whole park
const CAR_LENGTH = 3.8;
const TRUCK_LENGTH = 12;

// What one lot sends onto the roads. `index` is its plot.
export type TrafficSource = { id: string; index: number; cars: number; truck: boolean };

type Traveler = { key: string; truck: boolean; color: string; presence: number; vehicle: Vehicle };

// Every lot's cars and every busy lot's truck, driving all park roads. They appear on the
// roads around their own lot, then wander. Three instanced meshes draw them
// all: car bodies, car details, and trucks.
export class ParkTraffic {
  readonly group = new THREE.Group();
  private roads: Roads = roadGraph([]);
  private travelers: Traveler[] = [];
  private bodies = new THREE.InstancedMesh(carBodyGeometry, BAKED_MATERIAL, MAX_VEHICLES);
  private details = new THREE.InstancedMesh(carDetailGeometry, BAKED_MATERIAL, MAX_VEHICLES);
  private trucks = new THREE.InstancedMesh(truckGeometry, BAKED_MATERIAL, MAX_VEHICLES);
  private matrix = new THREE.Matrix4();
  private quaternion = new THREE.Quaternion();
  private position = new THREE.Vector3();
  private scale = new THREE.Vector3();
  private color = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);

  constructor() {
    // Instance colors must exist before the first render, or the shader ignores them.
    for (let i = 0; i < MAX_VEHICLES; i++) this.bodies.setColorAt(i, this.color.set("#ffffff"));
    for (const mesh of [this.bodies, this.details, this.trucks]) {
      mesh.count = 0;
      mesh.frustumCulled = false; // vehicles drive far from the mesh origin
      // Moving instances leave frozen shadows since shadowMap.autoUpdate is off.
      mesh.castShadow = false;
    }
    this.group.add(this.bodies, this.details, this.trucks);
  }

  // Call when the used cells change. Vehicles on roads that are gone disappear.
  setRoads(indexes: number[]) {
    this.roads = roadGraph(indexes);
    this.travelers = this.travelers.filter((t) => this.roads.lanes.has(t.vehicle.lane));
    for (const t of this.travelers) {
      if (!this.roads.lanes.has(t.vehicle.next))
        t.vehicle = { ...t.vehicle, next: pickNext(this.roads, t.vehicle.lane, Math.random) };
    }
  }

  tick(dt: number, sources: TrafficSource[]) {
    this.updateTravelers(dt, sources);
    const moved = stepVehicles(
      this.roads,
      this.travelers.map((t) => t.vehicle),
      dt,
      Math.random,
    );
    this.travelers.forEach((t, i) => {
      t.vehicle = moved[i];
    });
    this.draw();
  }

  // Spawns wanted vehicles, and grows or shrinks each one over 0.5 s.
  private updateTravelers(dt: number, sources: TrafficSource[]) {
    const wanted = new Set<string>();
    for (const source of sources) {
      const h = hash(source.id);
      for (let slot = 0; slot < source.cars && slot < MAX_MOVING_CARS; slot++) {
        this.want(wanted, `${source.id}/${slot}`, source.index, false, CAR_COLORS[(h + slot * 5) % CAR_COLORS.length]);
      }
      if (source.truck) this.want(wanted, `${source.id}/truck`, source.index, true, "");
    }
    const step = dt / 0.5;
    for (const t of this.travelers) {
      t.presence = wanted.has(t.key) ? Math.min(1, t.presence + step) : t.presence - step;
    }
    this.travelers = this.travelers.filter((t) => t.presence > 0);
  }

  private want(wanted: Set<string>, key: string, index: number, truck: boolean, color: string) {
    wanted.add(key);
    if (this.travelers.length >= MAX_VEHICLES || this.travelers.some((t) => t.key === key)) return;
    const speed = truck ? 7 : 8 + Math.random() * 3;
    const vehicles = this.travelers.map((t) => t.vehicle);
    const vehicle = spawnVehicle(this.roads, vehicles, index, speed, truck ? TRUCK_LENGTH : CAR_LENGTH, Math.random);
    if (vehicle) this.travelers.push({ key, truck, color, presence: 0, vehicle });
  }

  private draw() {
    let cars = 0;
    let trucks = 0;
    for (const t of this.travelers) {
      const pose = vehiclePose(this.roads, t.vehicle);
      this.quaternion.setFromAxisAngle(this.up, pose.heading);
      this.matrix.compose(
        this.position.set(pose.x, 0.05, pose.z),
        this.quaternion,
        this.scale.setScalar(Math.max(0.001, t.presence)),
      );
      if (t.truck) {
        this.trucks.setMatrixAt(trucks++, this.matrix);
      } else {
        this.bodies.setMatrixAt(cars, this.matrix);
        this.details.setMatrixAt(cars, this.matrix);
        this.bodies.setColorAt(cars++, this.color.set(t.color));
      }
    }
    this.bodies.count = this.details.count = cars;
    this.trucks.count = trucks;
    for (const mesh of [this.bodies, this.details, this.trucks]) mesh.instanceMatrix.needsUpdate = true;
    this.bodies.instanceColor!.needsUpdate = true;
  }
}
