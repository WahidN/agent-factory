import { describe, expect, it } from "vitest";
import {
  createWorker,
  LEAVE_DELAY_STEP,
  PAUSE_S,
  SAUNTER_SPEED,
  stepWorker,
  WALK_SPEED,
  type Point,
  type Worker,
} from "../worker-logic.ts";

const door: Point = { x: 0, z: 0 };
const route: [Point, Point] = [
  { x: 0, z: 5 },
  { x: 7, z: 5 },
];
const gate: Point = { x: 20, z: 9 };
const destination: Point = { x: 40, z: 30 };
const DT = 1 / 30;

// Runs the worker for `seconds`, calling `check` after every step.
function run(
  worker: Worker,
  seconds: number,
  busy: boolean,
  dest: Point | null = null,
  index = 0,
  check?: (w: Worker) => void,
) {
  for (let t = 0; t < seconds; t += DT) {
    worker = stepWorker(worker, DT, busy, door, route, gate, dest, index);
    check?.(worker);
  }
  return worker;
}

describe("stepWorker", () => {
  it("stays hidden inside while idle", () => {
    const worker = run(createWorker(door), 10, false);
    expect(worker.mode).toBe("inside");
    expect([worker.x, worker.z]).toEqual([0, 0]);
  });

  it("walks out to the route start when busy", () => {
    let worker = stepWorker(createWorker(door), DT, true, door, route, gate, null);
    expect(worker.mode).toBe("out");
    worker = run(worker, 5 / WALK_SPEED + 0.1, true);
    expect(worker.mode).toBe("working");
    expect([worker.x, worker.z]).toEqual([0, 5]);
  });

  it("stays on its route while working and pauses at the ends", () => {
    let worker = run(createWorker(door), 5 / WALK_SPEED + 0.2, true);
    expect(worker.mode).toBe("working");

    const pausedAt = { x: worker.x, z: worker.z };
    worker = run(worker, PAUSE_S - 0.3, true);
    expect([worker.x, worker.z]).toEqual([pausedAt.x, pausedAt.z]);

    let reachedFarEnd = false;
    worker = run(worker, 30, true, null, 0, (w) => {
      expect(w.z).toBeCloseTo(5);
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.x).toBeLessThanOrEqual(7);
      if (w.x === 7) reachedFarEnd = true;
    });
    expect(reachedFarEnd).toBe(true);
    expect(worker.walked).toBeGreaterThan(20);
  });

  it("walks back to the door and hides when idle (no destination)", () => {
    let worker = run(createWorker(door), 12, true);
    worker = stepWorker(worker, DT, false, door, route, gate, null);
    expect(worker.mode).toBe("in");
    worker = run(worker, 12 / WALK_SPEED, false);
    expect(worker.mode).toBe("inside");
    expect([worker.x, worker.z]).toEqual([0, 0]);
  });

  it("turns around when busy again on the way in (no destination)", () => {
    let worker = run(createWorker(door), 5 / WALK_SPEED + 0.2, true);
    worker = run(worker, 1, false);
    expect(worker.mode).toBe("in");
    const zOnTheWayIn = worker.z;
    expect(zOnTheWayIn).toBeLessThan(5);

    worker = stepWorker(worker, DT, true, door, route, gate, null);
    expect(worker.mode).toBe("out");
    worker = run(worker, 0.5, true);
    expect(worker.z).toBeGreaterThan(zOnTheWayIn);
  });

  it("faces the direction it walks", () => {
    const worker = run(createWorker(door), 1, true);
    // Walking from the door (0,0) toward (0,5) is +z, which is heading 0.
    expect(worker.heading).toBeCloseTo(0);
  });

  describe("with a leisure destination", () => {
    it("walks toward the destination, not the door, once idle", () => {
      let worker = run(createWorker(door), 5 / WALK_SPEED + 0.2, true, destination);
      expect(worker.mode).toBe("working");
      worker = run(worker, 5, false, destination);
      expect(worker.mode === "leaving" || worker.mode === "leisure").toBe(true);
      // Heading for the gate/destination, well away from the door and the job route.
      expect(worker.x).toBeGreaterThan(1);
    });

    it("passes through the gate on the way out", () => {
      let worker = run(createWorker(door), 5 / WALK_SPEED + 0.2, true, destination);
      worker = { ...worker, mode: "leaving", viaGate: true, pause: 0 };
      let passedGate = false;
      worker = run(worker, 90, false, destination, 0, (w) => {
        if (w.x === gate.x && w.z === gate.z) passedGate = true;
      });
      expect(passedGate).toBe(true);
      expect(worker.mode).toBe("leisure");
    });

    it("stays near the destination once arrived, even after a long time", () => {
      let worker: Worker = {
        ...createWorker(door),
        mode: "leisure",
        x: destination.x,
        z: destination.z,
        target: 1,
        pause: 0,
      };
      worker = run(worker, 120, false, destination, 0, (w) => {
        expect(w.x).toBeGreaterThanOrEqual(destination.x - 1.01);
        expect(w.x).toBeLessThanOrEqual(destination.x + 1.01);
        expect(w.z).toBeCloseTo(destination.z);
      });
    });

    it("returns to its job route once busy again", () => {
      let worker: Worker = {
        ...createWorker(door),
        mode: "leisure",
        x: destination.x,
        z: destination.z,
        target: 1,
        pause: 0,
      };
      let arrivedAt: Point | null = null;
      worker = run(worker, 45, true, destination, 0, (w) => {
        if (arrivedAt === null && w.mode === "working") arrivedAt = { x: w.x, z: w.z };
      });
      expect(worker.mode).toBe("working");
      expect(arrivedAt).toEqual(route[0]);
    });

    it("steers toward a changed destination without jumping there", () => {
      // The park repacks ranks constantly (see city-plan.ts), which recomputes
      // a lot's leisure destination. A worker already on its way must not
      // teleport to the new point: it keeps its position on the step where
      // the destination changes, then walks toward the new one from there.
      let worker: Worker = {
        ...createWorker(door),
        mode: "leisure",
        x: destination.x,
        z: destination.z,
        target: 1,
        pause: 0,
      };
      const newDestination: Point = { x: destination.x + 50, z: destination.z - 20 };
      const before = { x: worker.x, z: worker.z };
      worker = stepWorker(worker, DT, false, door, route, gate, newDestination, 0);
      // Only a normal walking step (speed * dt) away from where it stood, not
      // an instant relocation toward the new, far away destination.
      const stepDistance = Math.hypot(worker.x - before.x, worker.z - before.z);
      expect(stepDistance).toBeLessThanOrEqual(SAUNTER_SPEED * DT + 1e-9);

      worker = run(worker, 120, false, newDestination);
      const distanceToOld = Math.hypot(worker.x - destination.x, worker.z - destination.z);
      const distanceToNew = Math.hypot(worker.x - newDestination.x, worker.z - newDestination.z);
      expect(distanceToNew).toBeLessThan(distanceToOld);
      expect(distanceToNew).toBeLessThan(2);
    });

    it("walks the gate leg faster on the way back than on the way out", () => {
      expect(WALK_SPEED).toBeGreaterThan(SAUNTER_SPEED);
    });

    it("falls back to walking in, not a crash, if the destination disappears past the gate", () => {
      // The city plan recomputes destinations whenever ranks shift; a lot
      // already through the gate could in theory lose its target on the same
      // tick another session starts or stops.
      const worker: Worker = { ...createWorker(door), mode: "leaving", viaGate: false, pause: 0 };
      const stepped = stepWorker(worker, DT, false, door, route, gate, null, 0);
      expect(stepped.mode).toBe("in");
    });

    it("falls back to walking in, not a crash, if the destination disappears while lingering", () => {
      const worker: Worker = {
        ...createWorker(door),
        mode: "leisure",
        x: destination.x,
        z: destination.z,
        target: 1,
        pause: 0,
      };
      const stepped = stepWorker(worker, DT, false, door, route, gate, null, 0);
      expect(stepped.mode).toBe("in");
    });

    it("keeps the old behavior exactly when there is no destination", () => {
      let worker = run(createWorker(door), 5 / WALK_SPEED + 0.2, true, null);
      worker = run(worker, 1, false, null);
      expect(worker.mode).toBe("in");
    });

    it("staggers departures: a higher index waits longer before it moves", () => {
      let a = run(createWorker(door), 5 / WALK_SPEED + 0.2, true, destination, 0);
      let b = run(createWorker(door), 5 / WALK_SPEED + 0.2, true, destination, 3);
      const before = { a: { x: a.x, z: a.z }, b: { x: b.x, z: b.z } };
      a = stepWorker(a, DT, false, door, route, gate, destination, 0);
      b = stepWorker(b, DT, false, door, route, gate, destination, 3);
      expect(a.pause).toBe(0);
      expect(b.pause).toBeCloseTo(3 * LEAVE_DELAY_STEP);

      a = stepWorker(a, DT, false, door, route, gate, destination, 0);
      b = stepWorker(b, DT, false, door, route, gate, destination, 3);
      expect([a.x, a.z]).not.toEqual([before.a.x, before.a.z]);
      expect([b.x, b.z]).toEqual([before.b.x, before.b.z]);
    });
  });
});
