import { describe, expect, it } from "vitest";
import { createWorker, PAUSE_S, stepWorker, WALK_SPEED, type Point, type Worker } from "../worker-logic.ts";

const door: Point = { x: 0, z: 0 };
const route: [Point, Point] = [
  { x: 0, z: 5 },
  { x: 7, z: 5 },
];
const DT = 1 / 30;

// Runs the worker for `seconds`, calling `check` after every step.
function run(worker: Worker, seconds: number, busy: boolean, check?: (w: Worker) => void) {
  for (let t = 0; t < seconds; t += DT) {
    worker = stepWorker(worker, DT, busy, door, route);
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
    let worker = stepWorker(createWorker(door), DT, true, door, route);
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
    worker = run(worker, 30, true, (w) => {
      expect(w.z).toBeCloseTo(5);
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.x).toBeLessThanOrEqual(7);
      if (w.x === 7) reachedFarEnd = true;
    });
    expect(reachedFarEnd).toBe(true);
    expect(worker.walked).toBeGreaterThan(20);
  });

  it("walks back to the door and hides when idle", () => {
    let worker = run(createWorker(door), 12, true);
    worker = stepWorker(worker, DT, false, door, route);
    expect(worker.mode).toBe("in");
    worker = run(worker, 12 / WALK_SPEED, false);
    expect(worker.mode).toBe("inside");
    expect([worker.x, worker.z]).toEqual([0, 0]);
  });

  it("turns around when busy again on the way in", () => {
    let worker = run(createWorker(door), 5 / WALK_SPEED + 0.2, true);
    worker = run(worker, 1, false);
    expect(worker.mode).toBe("in");
    const zOnTheWayIn = worker.z;
    expect(zOnTheWayIn).toBeLessThan(5);

    worker = stepWorker(worker, DT, true, door, route);
    expect(worker.mode).toBe("out");
    worker = run(worker, 0.5, true);
    expect(worker.z).toBeGreaterThan(zOnTheWayIn);
  });

  it("faces the direction it walks", () => {
    const worker = run(createWorker(door), 1, true);
    // Walking from the door (0,0) toward (0,5) is +z, which is heading 0.
    expect(worker.heading).toBeCloseTo(0);
  });
});
