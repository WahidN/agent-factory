import { describe, expect, it } from "vitest";
import { type Box, type Keys, NO_KEYS, type Room, step, WALK_SPEED, WALKER_RADIUS } from "../walk.ts";

const DT = 1 / 60;
const room = (blockers: Box[] = []): Room => ({ halfX: 10, halfZ: 10, blockers });
const held = (keys: Partial<Keys>): Keys => ({ ...NO_KEYS, ...keys });
const desk = (x: number, z: number): Box => ({ x, z, halfX: 0.9, halfZ: 0.4 });

describe("step", () => {
  it("stands still without keys", () => {
    const start = { x: 1, z: 2 };
    expect(step(start, NO_KEYS, 0, DT, room())).toEqual(start);
  });

  it("walks the way the camera looks", () => {
    const moved = step({ x: 0, z: 0 }, held({ forward: true }), 0, DT, room());
    expect(moved.z).toBeCloseTo(-WALK_SPEED * DT, 5);
    expect(moved.x).toBeCloseTo(0, 5);
  });

  it("walks the other way after a quarter turn", () => {
    const moved = step({ x: 0, z: 0 }, held({ forward: true }), Math.PI / 2, DT, room());
    expect(moved.x).toBeCloseTo(-WALK_SPEED * DT, 5);
    expect(moved.z).toBeCloseTo(0, 5);
  });

  it("strafes square to the view", () => {
    const moved = step({ x: 0, z: 0 }, held({ right: true }), 0, DT, room());
    expect(moved.x).toBeCloseTo(WALK_SPEED * DT, 5);
    expect(moved.z).toBeCloseTo(0, 5);
  });

  it("is no faster on two keys than on one", () => {
    const one = step({ x: 0, z: 0 }, held({ forward: true }), 0, DT, room());
    const two = step({ x: 0, z: 0 }, held({ forward: true, right: true }), 0, DT, room());
    expect(Math.hypot(two.x, two.z)).toBeCloseTo(Math.hypot(one.x, one.z), 5);
  });

  it("stops at the wall", () => {
    let walker = { x: 0, z: 0 };
    for (let i = 0; i < 400; i++) walker = step(walker, held({ right: true }), 0, DT, room());
    expect(walker.x).toBeCloseTo(10 - WALKER_RADIUS, 5);
  });

  it("never steps through a wall on a long frame", () => {
    const walker = step({ x: 0, z: 0 }, held({ forward: true }), 0, 10, room());
    expect(Math.abs(walker.z)).toBeLessThanOrEqual(WALK_SPEED * 0.1 + 1e-9);
  });

  it("stops against a desk head on", () => {
    let walker = { x: 0, z: 0 };
    for (let i = 0; i < 200; i++) walker = step(walker, held({ forward: true }), 0, DT, room([desk(0, -3)]));
    expect(walker.z).toBeCloseTo(-3 + 0.4 + WALKER_RADIUS, 5);
  });

  it("slides along a desk hit at an angle", () => {
    const face = -3 + 0.4 + WALKER_RADIUS; // standing against the desk's near side
    const moved = step({ x: 0, z: face }, held({ forward: true, right: true }), 0, DT, room([desk(0, -3)]));
    expect(moved.z).toBeCloseTo(face, 5); // the desk holds it
    expect(moved.x).toBeGreaterThan(0); // and it keeps moving along it
  });

  it("walks on once it is past the desk", () => {
    let walker = { x: 0, z: 0 };
    for (let i = 0; i < 200; i++) {
      walker = step(walker, held({ forward: true, right: true }), 0, DT, room([desk(0, -3)]));
    }
    expect(walker.x).toBeGreaterThan(0.9 + WALKER_RADIUS); // past its edge
    expect(walker.z).toBeLessThan(-3); // and beyond it
  });

  it("leaves a desk beside the walkway alone", () => {
    const moved = step({ x: 0, z: 0 }, held({ forward: true }), 0, DT, room([desk(5, -0.2)]));
    expect(moved.z).toBeCloseTo(-WALK_SPEED * DT, 5);
  });

  it("stops against a robot", () => {
    const robot: Box = { x: 0, z: -2, halfX: 0.3, halfZ: 0.3 };
    let walker = { x: 0, z: 0 };
    for (let i = 0; i < 200; i++) walker = step(walker, held({ forward: true }), 0, DT, room([robot]));
    expect(walker.z).toBeCloseTo(-2 + 0.3 + WALKER_RADIUS, 5);
  });
});
