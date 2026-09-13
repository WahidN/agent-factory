// How a worker walks. Pure, so it can be tested with a fake clock.
//
// inside  -> busy: appear at the door, walk out
// out     -> walk to the start of the route, then work
// working -> walk back and forth along the route, pausing at each end
// in      -> walk back to the door, then disappear

export type Point = { x: number; z: number };
export type WorkerMode = "inside" | "out" | "working" | "in";
export type Worker = {
  x: number;
  z: number;
  heading: number; // rotation around y for a model facing +z
  mode: WorkerMode;
  target: 0 | 1;
  pause: number;
  walked: number; // total distance, drives the walking bob
};

export const WALK_SPEED = 1.4;
export const PAUSE_S = 1.2;

export function createWorker(door: Point): Worker {
  return { x: door.x, z: door.z, heading: 0, mode: "inside", target: 0, pause: 0, walked: 0 };
}

// Moves toward a point; `arrived` is true once it is reached.
function walk(worker: Worker, to: Point, dt: number): { worker: Worker; arrived: boolean } {
  const dx = to.x - worker.x;
  const dz = to.z - worker.z;
  const remaining = Math.hypot(dx, dz);
  const step = WALK_SPEED * dt;
  if (remaining <= step) {
    return { worker: { ...worker, x: to.x, z: to.z, walked: worker.walked + remaining }, arrived: true };
  }
  const k = step / remaining;
  return {
    worker: { ...worker, x: worker.x + dx * k, z: worker.z + dz * k, heading: Math.atan2(dx, dz), walked: worker.walked + step },
    arrived: false,
  };
}

export function stepWorker(worker: Worker, dt: number, busy: boolean, door: Point, route: [Point, Point]): Worker {
  switch (worker.mode) {
    case "inside":
      return busy ? { ...worker, x: door.x, z: door.z, mode: "out" } : worker;

    case "out": {
      if (!busy) return { ...worker, mode: "in" };
      const { worker: moved, arrived } = walk(worker, route[0], dt);
      return arrived ? { ...moved, mode: "working", target: 1, pause: PAUSE_S } : moved;
    }

    case "working": {
      if (!busy) return { ...worker, mode: "in" };
      if (worker.pause > 0) return { ...worker, pause: Math.max(0, worker.pause - dt) };
      const { worker: moved, arrived } = walk(worker, route[worker.target], dt);
      return arrived ? { ...moved, target: worker.target === 0 ? 1 : 0, pause: PAUSE_S } : moved;
    }

    case "in": {
      if (busy) return { ...worker, mode: "out" };
      const { worker: moved, arrived } = walk(worker, door, dt);
      return arrived ? { ...moved, mode: "inside" } : moved;
    }
  }
}
