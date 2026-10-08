// Walking an office floor in the first person: which keys are held, and where
// one step lands. `step` is pure and has no Three.js in it, so what happens
// when you walk into a desk is testable without a scene.
//
// The walker is a circle on a flat floor. There is no gravity, no step height
// and no slopes: the whole floor is one level, so a circle against a handful
// of boxes is all the collision this needs.

export type Walker = { x: number; z: number };

/** An axis aligned box on the floor: a desk, a chair or a robot. */
export type Box = { x: number; z: number; halfX: number; halfZ: number };

/** The room's inner size. The walls are handled as bounds, not as boxes. */
export type Room = { halfX: number; halfZ: number; blockers: Box[] };

export type Keys = { forward: boolean; back: boolean; left: boolean; right: boolean };

export const WALK_SPEED = 3.2; // metres a second, a walking pace
export const WALKER_RADIUS = 0.35;
export const EYE_HEIGHT = 1.7;

// A frame longer than this is treated as this long. The frame loop clamps
// already; this keeps the step short enough to never cross a wall on its own,
// whatever the caller does.
const MAX_STEP_SECONDS = 0.1;

export const NO_KEYS: Keys = { forward: false, back: false, left: false, right: false };

/**
 * One step, from the keys held and where the camera is looking. `yaw` is the
 * camera's rotation around y, so walking is always relative to the view.
 */
export function step(walker: Walker, keys: Keys, yaw: number, dt: number, room: Room): Walker {
  const forward = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
  const right = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (forward === 0 && right === 0) return walker;

  // A camera looks down its own -z, so its forward in the world is
  // (-sin, -cos) and its right is (cos, -sin).
  let dx = forward * -Math.sin(yaw) + right * Math.cos(yaw);
  let dz = forward * -Math.cos(yaw) + right * -Math.sin(yaw);
  // Two keys at once must not walk faster than one.
  const length = Math.hypot(dx, dz);
  const distance = WALK_SPEED * Math.min(dt, MAX_STEP_SECONDS);
  dx = (dx / length) * distance;
  dz = (dz / length) * distance;

  // x and z are moved one after the other, each pushed back out of whatever
  // it landed in. Moving both at once and pushing out afterwards would stop
  // you dead against a desk you only clipped with a corner; this slides you
  // along it.
  let x = clamp(walker.x + dx, room.halfX - WALKER_RADIUS);
  for (const box of room.blockers) x = pushOut(x, walker.z, box, "x");
  let z = clamp(walker.z + dz, room.halfZ - WALKER_RADIUS);
  for (const box of room.blockers) z = pushOut(z, x, box, "z");
  return { x, z };
}

function clamp(value: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, value));
}

// Pushes the walker out of one box along one axis, leaving the other axis
// where it is. `along` names the axis being resolved.
function pushOut(moved: number, other: number, box: Box, along: "x" | "z"): number {
  const center = along === "x" ? box.x : box.z;
  const half = along === "x" ? box.halfX : box.halfZ;
  const otherCenter = along === "x" ? box.z : box.x;
  const otherHalf = along === "x" ? box.halfZ : box.halfX;
  if (Math.abs(other - otherCenter) >= otherHalf + WALKER_RADIUS) return moved;
  const limit = half + WALKER_RADIUS;
  const offset = moved - center;
  if (Math.abs(offset) >= limit) return moved;
  return center + (offset < 0 ? -limit : limit);
}

// Which keys are down. Read by `code`, so a different keyboard layout walks
// the same way, and cleared when the page stops seeing the keyboard: a tab
// switched away from while W is held would otherwise walk on forever.
export class HeldKeys {
  readonly keys: Keys = { ...NO_KEYS };

  private onDown = (event: KeyboardEvent) => this.set(event.code, true);
  private onUp = (event: KeyboardEvent) => this.set(event.code, false);
  private onLeave = () => this.clear();

  attach(target: Window = window) {
    target.addEventListener("keydown", this.onDown);
    target.addEventListener("keyup", this.onUp);
    target.addEventListener("blur", this.onLeave);
    target.document.addEventListener("visibilitychange", this.onLeave);
  }

  detach(target: Window = window) {
    target.removeEventListener("keydown", this.onDown);
    target.removeEventListener("keyup", this.onUp);
    target.removeEventListener("blur", this.onLeave);
    target.document.removeEventListener("visibilitychange", this.onLeave);
    this.clear();
  }

  clear() {
    Object.assign(this.keys, NO_KEYS);
  }

  private set(code: string, down: boolean) {
    if (code === "KeyW" || code === "ArrowUp") this.keys.forward = down;
    else if (code === "KeyS" || code === "ArrowDown") this.keys.back = down;
    else if (code === "KeyA" || code === "ArrowLeft") this.keys.left = down;
    else if (code === "KeyD" || code === "ArrowRight") this.keys.right = down;
  }
}
