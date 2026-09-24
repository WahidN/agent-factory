// How a worker walks. Pure, so it can be tested with a fake clock.
//
// With a leisure destination (a park, a landmark, any non-factory cell):
//   inside   -> busy: appear at the door, walk out
//   out      -> walk to the start of the route, then work
//   working  -> walk back and forth along the route, pausing at each end
//   leaving  -> idle: walk out through the gate, then to the destination
//   leisure  -> walk back and forth near the destination, pausing at each end
//   returning -> busy again: walk back through the gate, then to the route
// A worker that is inside while idle also leaves, as long as it has a
// destination; otherwise a lot that starts idle (a snapshot, an LOD rebuild)
// never sends anyone to the park.
// Without a destination the simpler loop still applies: idle sends a
// working/out worker straight to "in", back to the door, then inside.

export type Point = { x: number; z: number };
export type WorkerMode = "inside" | "out" | "working" | "in" | "leaving" | "leisure" | "returning";
export type Worker = {
  x: number;
  z: number;
  heading: number; // rotation around y for a model facing +z
  mode: WorkerMode;
  target: 0 | 1;
  pause: number;
  walked: number; // total distance, drives the walking bob
  viaGate: boolean; // still has to reach the gate before its leisure/work leg
};

export const WALK_SPEED = 1.4;
export const SAUNTER_SPEED = 0.8; // slower stroll to and around a leisure destination
export const PAUSE_S = 1.2;
// Staggers departures for leisure: worker `index` waits this many extra
// seconds before it starts walking, so eight workers never leave as one block.
export const LEAVE_DELAY_STEP = 0.4;

export function createWorker(door: Point): Worker {
  return { x: door.x, z: door.z, heading: 0, mode: "inside", target: 0, pause: 0, walked: 0, viaGate: false };
}

// Moves toward a point; `arrived` is true once it is reached.
function walk(worker: Worker, to: Point, dt: number, speed: number = WALK_SPEED): { worker: Worker; arrived: boolean } {
  const dx = to.x - worker.x;
  const dz = to.z - worker.z;
  const remaining = Math.hypot(dx, dz);
  const step = speed * dt;
  if (remaining <= step) {
    return { worker: { ...worker, x: to.x, z: to.z, walked: worker.walked + remaining }, arrived: true };
  }
  const k = step / remaining;
  return {
    worker: {
      ...worker,
      x: worker.x + dx * k,
      z: worker.z + dz * k,
      heading: Math.atan2(dx, dz),
      walked: worker.walked + step,
    },
    arrived: false,
  };
}

// Two points near a destination to hang around between, the same shape as a
// job route.
function leisureRoute(destination: Point): [Point, Point] {
  return [
    { x: destination.x - 1, z: destination.z },
    { x: destination.x + 1, z: destination.z },
  ];
}

// A working/out worker going idle: to its leisure destination if it has one
// (staggered by `index`), otherwise the fallback, straight back to the door.
function startLeaving(worker: Worker, destination: Point | null, index: number): Worker {
  if (!destination) return { ...worker, mode: "in" };
  return { ...worker, mode: "leaving", viaGate: true, pause: index * LEAVE_DELAY_STEP };
}

// True while the worker is beyond the gate, out in the world rather than on
// its lot's yard. Its x/z are still lot-local, so when the lot moves these
// are the ones that must be compensated to stay put on screen.
export function isOutside(worker: Worker): boolean {
  return (
    (worker.mode === "leaving" && !worker.viaGate) ||
    worker.mode === "leisure" ||
    (worker.mode === "returning" && worker.viaGate)
  );
}

export function stepWorker(
  worker: Worker,
  dt: number,
  busy: boolean,
  door: Point,
  route: [Point, Point],
  gate: Point,
  destination: Point | null,
  index = 0,
): Worker {
  switch (worker.mode) {
    case "inside":
      if (busy) return { ...worker, x: door.x, z: door.z, mode: "out" };
      return destination ? startLeaving({ ...worker, x: door.x, z: door.z }, destination, index) : worker;

    case "out": {
      if (!busy) return startLeaving(worker, destination, index);
      const { worker: moved, arrived } = walk(worker, route[0], dt);
      return arrived ? { ...moved, mode: "working", target: 1, pause: PAUSE_S } : moved;
    }

    case "working": {
      if (!busy) return startLeaving(worker, destination, index);
      if (worker.pause > 0) return { ...worker, pause: Math.max(0, worker.pause - dt) };
      const { worker: moved, arrived } = walk(worker, route[worker.target], dt);
      return arrived ? { ...moved, target: worker.target === 0 ? 1 : 0, pause: PAUSE_S } : moved;
    }

    // Walks out through the gate, then on to the destination.
    case "leaving": {
      if (busy) return { ...worker, mode: "returning", viaGate: !worker.viaGate };
      if (!destination) {
        // Still on the yard side: no gate leg left worth taking, go straight in.
        if (worker.viaGate) return { ...worker, mode: "in" };
        // Past the gate: head back the way it came instead of cutting
        // straight to the door through whatever stands between.
        return { ...worker, mode: "returning", viaGate: true };
      }
      if (worker.pause > 0) return { ...worker, pause: Math.max(0, worker.pause - dt) };
      const to = worker.viaGate ? gate : destination!;
      const { worker: moved, arrived } = walk(worker, to, dt, SAUNTER_SPEED);
      if (!arrived) return moved;
      if (worker.viaGate) return { ...moved, viaGate: false };
      return { ...moved, mode: "leisure", target: 1, pause: PAUSE_S };
    }

    case "leisure": {
      // Also routes back through the gate rather than jumping straight in,
      // whether it is busy again or simply has nowhere left to linger.
      if (busy || !destination) return { ...worker, mode: "returning", viaGate: true };
      if (worker.pause > 0) return { ...worker, pause: Math.max(0, worker.pause - dt) };
      const to = leisureRoute(destination)[worker.target];
      const { worker: moved, arrived } = walk(worker, to, dt, SAUNTER_SPEED);
      return arrived ? { ...moved, target: worker.target === 0 ? 1 : 0, pause: PAUSE_S } : moved;
    }

    // Walks back through the gate, then on to its job route, or (without a
    // destination any more) on through to the door.
    case "returning": {
      if (busy) {
        const to = worker.viaGate ? gate : route[0];
        const { worker: moved, arrived } = walk(worker, to, dt);
        if (!arrived) return moved;
        if (worker.viaGate) return { ...moved, viaGate: false };
        return { ...moved, mode: "working", target: 1, pause: PAUSE_S };
      }
      if (!destination) {
        const to = worker.viaGate ? gate : door;
        const { worker: moved, arrived } = walk(worker, to, dt, SAUNTER_SPEED);
        if (!arrived) return moved;
        if (worker.viaGate) return { ...moved, viaGate: false };
        return { ...moved, mode: "in" };
      }
      return { ...worker, mode: "leaving", viaGate: !worker.viaGate };
    }

    case "in": {
      if (busy) return { ...worker, mode: "out" };
      const { worker: moved, arrived } = walk(worker, door, dt);
      return arrived ? { ...moved, mode: "inside" } : moved;
    }
  }
}
