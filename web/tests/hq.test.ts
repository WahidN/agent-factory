import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Hq } from "../hq.ts";

const FLOOR = 6; // WALL_BAY.height: one row of windows

// An HQ starts underground and rises. One long tick settles it, so a bounding
// box is measured against the ground instead of against the sink.
function settled(user: string, tokens: number, agents = 1): Hq {
  const hq = new Hq(user, tokens, agents);
  hq.tick(2);
  return hq;
}

function highestPoint(hq: Hq): number {
  return new THREE.Box3().setFromObject(hq.group).max.y;
}

function roofLetters(hq: Hq): THREE.Object3D[] {
  const letters: THREE.Object3D[] = [];
  hq.group.traverse((child) => {
    if (child.userData.sharedGeometry) letters.push(child);
  });
  return letters;
}

describe("Hq", () => {
  it("adds a floor for every ladder row the user earned", () => {
    // 0 tokens is one floor, 600M is seven: six floors of difference.
    expect(highestPoint(settled("dennis", 600e6)) - highestPoint(settled("dennis", 0))).toBeCloseTo(6 * FLOOR);
  });

  it("rebuilds in place when the total crosses a row", () => {
    const hq = settled("dennis", 99e6);
    const before = highestPoint(hq);
    hq.update(101e6, 1);
    hq.tick(2);
    expect(highestPoint(hq) - before).toBeCloseTo(FLOOR);
  });

  it("stands the user's name on the roof", () => {
    expect(roofLetters(settled("noor", 0))).toHaveLength(4);
    expect(roofLetters(settled("dennis", 0))).toHaveLength(6);
  });

  it("moors the blimp above the tower once the ladder is full", () => {
    const roof = 0.2 + 1 + 11 * FLOOR; // yard, plinth, eleven floors
    // The roof letters reach about 4.4 over the roof. Only the blimp, which
    // floats 12 up and bobs, gets higher than that.
    expect(highestPoint(settled("noor", 5e9))).toBeGreaterThan(roof + 10);
  });

  it("sinks everything it holds under the ground, blimp included", () => {
    const hq = settled("noor", 5e9);
    let gone = false;
    hq.remove(() => {
      gone = true;
    });
    for (let frame = 0; frame < 200 && !gone; frame++) hq.tick(1 / 30);
    expect(gone).toBe(true);
    expect(highestPoint(hq)).toBeLessThan(0);
  });

  it("answers the pointer with the user, its agents and its total", () => {
    const hq = settled("noor", 4.43e9, 3);
    expect(hq.hq).toEqual({ user: "noor", agents: 3, tokens: 4.43e9 });
    for (const mesh of hq.pickables()) expect(mesh.userData.hover).toBe(hq);
  });

  it("lets the pointer hit the tower and nothing else on the block", () => {
    // The walls and the accent parts, and not the mesh the plaza, the lawns
    // and the planters are baked into.
    expect(settled("noor", 0).pickables()).toHaveLength(2);
  });

  it("follows the agent count without rebuilding the tower", () => {
    const hq = settled("noor", 600e6, 1);
    const before = highestPoint(hq);
    hq.update(600e6, 4);
    expect(hq.hq.agents).toBe(4);
    expect(highestPoint(hq)).toBeCloseTo(before);
  });

  it("keeps the letters when a rebuild disposes the rest", () => {
    const hq = settled("noor", 0);
    hq.update(5e9, 1);
    hq.tick(2);
    const [letter] = roofLetters(hq);
    expect(letter).toBeDefined();
    expect((letter as THREE.Mesh).geometry.attributes.position.count).toBeGreaterThan(0);
  });
});
