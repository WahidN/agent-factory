import * as THREE from "three";
import { COLORS, MATERIALS, standard } from "./palette.ts";
import { BAKED_MATERIAL, StaticBuilder } from "./static-builder.ts";
import {
  MAX_BUSES,
  MAX_CYCLISTS,
  MAX_TRAINS,
  UrbanMobilitySimulation,
  type MobilityCity,
  type MobilityPose,
} from "./urban-mobility-logic.ts";

const wheel = new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2);
const riderHead = new THREE.SphereGeometry(1, 8, 6);

const bikeRed = standard("#b63a34");
const brengYellow = standard("#f2cf16");
const brengBlue = standard("#174d73");
const nsYellow = standard("#ffc917");
const nsBlue = standard("#003082");
const glass = standard(COLORS.glass);
const skin = standard("#c88c68");

function modelGeometry(build: (builder: StaticBuilder) => void): THREE.BufferGeometry {
  const builder = new StaticBuilder();
  build(builder);
  return (builder.build().children[0] as THREE.Mesh).geometry;
}

// One baked mesh per vehicle type. The silhouettes carry the identity: upright
// Dutch cyclist, Breng's yellow/blue city bus and the NS double-cab train.
const cyclistGeometry = modelGeometry((b) => {
  for (const x of [-0.72, 0.72]) b.add(wheel, MATERIALS.darkSteel, [x, 0.62, 0], [0.48, 0.08, 0.48]);
  b.box(bikeRed, [0, 0.73, 0], [1.35, 0.09, 0.1], [0, 0, -0.22]);
  b.box(bikeRed, [-0.24, 1.02, 0], [0.08, 0.72, 0.08], [0, 0, 0.4]);
  b.box(MATERIALS.darkSteel, [0.48, 1.05, 0], [0.08, 0.68, 0.08], [0, 0, -0.35]);
  b.box(brengBlue, [-0.14, 1.45, 0], [0.42, 0.72, 0.34], [0, 0, -0.18]);
  b.add(riderHead, skin, [-0.22, 1.98, 0], [0.22, 0.22, 0.22]);
});

const busGeometry = modelGeometry((b) => {
  b.box(brengYellow, [0, 1.35, 0], [10.5, 2.7, 2.55]);
  b.box(brengBlue, [-0.4, 2.22, 0], [8.9, 0.72, 2.59]);
  b.box(glass, [5.26, 2.05, 0], [0.05, 0.95, 2.15]);
  b.box(standard("#ffffff"), [1.2, 1.3, -1.3], [4.4, 0.34, 0.05]);
  for (const x of [-3.25, 3.35]) {
    for (const z of [-1.22, 1.22]) b.add(wheel, MATERIALS.darkSteel, [x, 0.56, z], [0.48, 0.24, 0.48]);
  }
});

const trainGeometry = modelGeometry((b) => {
  b.box(nsYellow, [0, 1.65, 0], [21, 3.1, 4.9]);
  b.box(nsBlue, [0, 2.2, 0], [17, 0.78, 4.94]);
  b.box(glass, [-10.53, 2.28, 0], [0.05, 0.9, 3.2]);
  b.box(glass, [10.53, 2.28, 0], [0.05, 0.9, 3.2]);
  for (const x of [-7.4, 7.4]) {
    b.box(MATERIALS.darkSteel, [x, 0.43, 0], [2.2, 0.45, 4.15]);
  }
});

/** Three draw calls total, independent of the visible vehicle count. */
export class UrbanMobility {
  readonly group = new THREE.Group();
  readonly simulation = new UrbanMobilitySimulation();
  private cyclists = new THREE.InstancedMesh(cyclistGeometry, BAKED_MATERIAL, MAX_CYCLISTS);
  private buses = new THREE.InstancedMesh(busGeometry, BAKED_MATERIAL, MAX_BUSES);
  private trains = new THREE.InstancedMesh(trainGeometry, BAKED_MATERIAL, MAX_TRAINS);
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private quaternion = new THREE.Quaternion();
  private scale = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);
  private pose: MobilityPose = { x: 0, y: 0, z: 0, heading: 0 };

  constructor() {
    for (const mesh of [this.cyclists, this.buses, this.trains]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      // Moving instances leave frozen shadows since shadowMap.autoUpdate is off.
      mesh.castShadow = false;
      this.group.add(mesh);
    }
  }

  setCity(city: MobilityCity = {}): void {
    this.simulation.setCity(city);
    this.draw();
  }

  setRoads(indexes: readonly number[]): void {
    this.simulation.setRoads(indexes);
    this.draw();
  }

  tick(dtSeconds: number): void {
    this.simulation.tick(dtSeconds);
    this.draw();
  }

  private draw(): void {
    const counts = this.simulation.counts();
    for (let i = 0; i < counts.cyclists; i++) {
      this.simulation.cyclistPose(i, this.pose);
      this.setInstance(this.cyclists, i, 1);
    }
    for (let i = 0; i < counts.buses; i++) {
      this.simulation.busPose(i, this.pose);
      this.setInstance(this.buses, i, 1);
    }
    for (let i = 0; i < counts.trains; i++) {
      this.simulation.trainPose(this.pose);
      this.setInstance(this.trains, i, 1);
    }
    this.cyclists.count = counts.cyclists;
    this.buses.count = counts.buses;
    this.trains.count = counts.trains;
    this.cyclists.instanceMatrix.needsUpdate = true;
    this.buses.instanceMatrix.needsUpdate = true;
    this.trains.instanceMatrix.needsUpdate = true;
  }

  private setInstance(mesh: THREE.InstancedMesh, index: number, scale: number): void {
    this.position.set(this.pose.x, this.pose.y, this.pose.z);
    this.quaternion.setFromAxisAngle(this.up, this.pose.heading);
    this.scale.setScalar(scale);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    mesh.setMatrixAt(index, this.matrix);
  }
}
