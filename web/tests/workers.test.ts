import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { Point } from "../worker-logic.ts";
import { LotWorkers, type WorkerSlot } from "../workers.ts";

const door: Point = { x: 0, z: 0 };
const gate: Point = { x: 5, z: 0 };
const slot = (destination: Point | null): WorkerSlot => ({
  door,
  route: [
    { x: 0, z: 2 },
    { x: 2, z: 2 },
  ],
  gate,
  destination,
});

function positionOf(workers: LotWorkers, i: number): THREE.Vector3 | null {
  const m = new THREE.Matrix4();
  workers.mesh.getMatrixAt(i, m);
  // Hidden workers get an all-zero scale matrix; decompose() would report scale 1 for that.
  if (m.elements.slice(0, 12).every((e) => e === 0)) return null;
  return new THREE.Vector3().setFromMatrixPosition(m);
}

function tickFor(workers: LotWorkers, seconds: number, busy: (boolean | null)[]) {
  for (let t = 0; t < seconds; t += 1 / 30) workers.tick(1 / 30, busy);
}

describe("LotWorkers", () => {
  it("shows idle workers heading out, but never one for a slot that has no worker", () => {
    const workers = new LotWorkers([slot({ x: 20, z: 0 }), slot({ x: 20, z: 0 })]);
    tickFor(workers, 5, [false, null]);
    expect(positionOf(workers, 0)).not.toBeNull();
    expect(positionOf(workers, 1)).toBeNull();
  });

  it("keeps a worker that is out in the world in place when its lot moves", () => {
    const workers = new LotWorkers([slot({ x: 20, z: 0 })]);
    tickFor(workers, 60, [false]);
    const before = positionOf(workers, 0);
    expect(before).not.toBeNull();
    expect(before!.x).toBeGreaterThan(gate.x); // past the gate, out in the world

    // The lot jumped +10 in x, so in lot coordinates the world stays put at -10.
    workers.translate(-10, 0);
    workers.tick(0, [false]);
    const after = positionOf(workers, 0);
    expect(after!.x).toBeCloseTo(before!.x - 10, 1);
    expect(after!.z).toBeCloseTo(before!.z, 1);
  });

  it("moves a worker still on the yard along with its lot", () => {
    const workers = new LotWorkers([slot({ x: 20, z: 0 })]);
    tickFor(workers, 3, [true]); // on its job route inside the yard
    const before = positionOf(workers, 0);
    workers.translate(-10, 0);
    workers.tick(0, [true]);
    expect(positionOf(workers, 0)!.x).toBeCloseTo(before!.x, 1);
  });
});
