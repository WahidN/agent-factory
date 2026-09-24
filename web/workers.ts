// Small workers with hard hats and safety vests, drawn as one instanced mesh per lot.

import * as THREE from "three";
import { YARD_Y } from "./machines.ts";
import { standard } from "./palette.ts";
import { BAKED_MATERIAL, StaticBuilder } from "./static-builder.ts";
import { createWorker, isOutside, stepWorker, type Point, type Worker } from "./worker-logic.ts";

export type WorkerSlot = { door: Point; route: [Point, Point]; gate: Point; destination: Point | null };

// About 1.9 tall, facing +z.
const workerGeometry = (() => {
  const b = new StaticBuilder();
  const trousers = standard("#2f3e5c");
  const vest = standard("#f28c28");
  const stripe = standard("#e8e8e0");
  const skin = standard("#e0b48a");
  const hat = standard("#f2c230");
  for (const x of [-0.12, 0.12]) b.box(trousers, [x, 0.42, 0], [0.18, 0.84, 0.26]);
  b.box(vest, [0, 1.18, 0], [0.56, 0.72, 0.34]);
  b.box(stripe, [0, 1.12, 0], [0.58, 0.08, 0.36]);
  for (const x of [-0.36, 0.36]) b.box(vest, [x, 1.12, 0], [0.14, 0.62, 0.18]);
  b.box(skin, [0, 1.7, 0], [0.3, 0.32, 0.3]);
  b.cylinder(hat, [0, 1.9, 0], [0.22, 0.14, 0.22]);
  b.cylinder(hat, [0, 1.84, 0.04], [0.27, 0.04, 0.3]);
  return (b.build().children[0] as THREE.Mesh).geometry;
})();

export class LotWorkers {
  readonly mesh: THREE.InstancedMesh;
  private workers: Worker[];
  private matrix = new THREE.Matrix4();
  private quaternion = new THREE.Quaternion();
  private position = new THREE.Vector3();
  private scale = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(private slots: WorkerSlot[]) {
    this.mesh = new THREE.InstancedMesh(workerGeometry, BAKED_MATERIAL, slots.length);
    // Moving instances leave frozen shadows since shadowMap.autoUpdate is off.
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false; // workers walk away from the mesh origin
    this.workers = slots.map((slot) => createWorker(slot.door));
    for (let i = 0; i < slots.length; i++) this.mesh.setMatrixAt(i, this.hidden);
  }

  // Swaps in new slots (new doors, routes, gate, destinations) without
  // touching `this.workers`: each worker keeps its current position and mode,
  // so one already walking toward the old destination steers toward the new
  // one from where it stands instead of jumping there.
  setSlots(slots: WorkerSlot[]) {
    this.slots = slots;
  }

  // The lot moved by (-dx, -dz) in the world. Workers out beyond the gate are
  // standing on world ground, so they shift the other way in lot coordinates
  // and stay where they were on screen; workers on the yard ride along.
  translate(dx: number, dz: number) {
    this.workers = this.workers.map((worker) =>
      isOutside(worker) ? { ...worker, x: worker.x + dx, z: worker.z + dz } : worker,
    );
  }

  // `busy` holds one flag per slot, in the same order as the slots. `null`
  // means there is no worker for that slot right now (a warehouse that is not
  // there): it never leaves for the park and walks back in if it was out.
  tick(dt: number, busy: (boolean | null)[]) {
    this.workers = this.workers.map((worker, i) =>
      stepWorker(
        worker,
        dt,
        busy[i] ?? false,
        this.slots[i].door,
        this.slots[i].route,
        this.slots[i].gate,
        busy[i] === null ? null : this.slots[i].destination,
        i,
      ),
    );
    this.workers.forEach((worker, i) => {
      if (worker.mode === "inside") {
        this.mesh.setMatrixAt(i, this.hidden);
        return;
      }
      const bob = Math.abs(Math.sin(worker.walked * 3.5)) * 0.07;
      this.quaternion.setFromAxisAngle(this.up, worker.heading);
      this.position.set(worker.x, YARD_Y + bob, worker.z);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(i, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
