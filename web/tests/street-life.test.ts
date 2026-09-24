import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { CityClaim } from "../city-events.ts";
import { StreetLife } from "../street-life.ts";

const claims: CityClaim[] = [
  { cell: { col: 2, row: 0 }, amenity: "plein1944" },
  { cell: { col: 5, row: 1 }, amenity: "waalkade" },
  { cell: { col: 3, row: 3 }, amenity: "park" },
  { cell: { col: 3, row: 1 }, amenity: "valkhof" },
  { cell: { col: 6, row: 2 }, amenity: "shops" },
];

function matrices(life: StreetLife) {
  const matrix = new THREE.Matrix4();
  return life.group.children.flatMap((child) => {
    const mesh = child as THREE.InstancedMesh;
    return Array.from({ length: mesh.count }, (_, index) => {
      mesh.getMatrixAt(index, matrix);
      return matrix.elements.map((value) => Number(value.toFixed(5)));
    });
  });
}

describe("StreetLife", () => {
  it("is deterministic for an unordered set of city claims", () => {
    const first = new StreetLife();
    const second = new StreetLife();
    const activity = { hour: 15, busyRatio: 0.65 };
    first.setCity(claims, activity);
    second.setCity([...claims].reverse(), activity);
    expect(first.snapshot()).toEqual(second.snapshot());
    expect(matrices(first)).toEqual(matrices(second));
  });

  it("opens terraces and parks by day and clears them late at night", () => {
    const life = new StreetLife();
    life.setCity(claims, { hour: 15, busyRatio: 0.7 });
    expect(life.snapshot().tables).toBeGreaterThan(0);
    expect(life.snapshot().parasols).toBeGreaterThan(0);
    expect(life.snapshot().visitors).toBeGreaterThan(0);

    life.setActivity({ hour: 2, busyRatio: 1 });
    expect(life.snapshot()).toMatchObject({ tables: 0, parasols: 0, visitors: 0, instances: 0 });
  });

  it("reuses five bounded instanced meshes across activity modes", () => {
    const life = new StreetLife();
    const children = [...life.group.children];
    life.setCity(claims, { hour: 18, busyRatio: 5 });
    expect(life.group.children).toEqual(children);
    expect(life.group.children).toHaveLength(5);
    expect(life.snapshot().drawCalls).toBeLessThanOrEqual(5);
    expect(life.snapshot().tables).toBeLessThanOrEqual(30);
    expect(life.snapshot().parasols).toBeLessThanOrEqual(24);
    expect(life.snapshot().visitors).toBeLessThanOrEqual(72);
    expect(life.snapshot().instances).toBeLessThanOrEqual(30 * 2 + 24 + 72 * 2);

    life.setActivity({ hour: 12, busyRatio: 0.2 });
    expect(life.group.children).toEqual(children);
  });
});
