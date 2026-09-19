import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CELL_HALF } from "../cell-build.ts";
import { CITY_LANDMARKS, pitchedRoofRotationX } from "../landmarks-city.ts";
import { StaticBuilder } from "../static-builder.ts";

// Deterministic seeded random, same shape as the one park.ts uses.
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function vertexCount(group: THREE.Group) {
  return group.children.reduce((sum, child) => sum + (child as THREE.Mesh).geometry.attributes.position.count, 0);
}

const NAMES = ["stevenskerk", "goffert", "plein1944", "kronenburgerpark", "station", "linku"] as const;

describe("CITY_LANDMARKS", () => {
  for (const name of NAMES) {
    describe(name, () => {
      it("builds without throwing and produces geometry", () => {
        const builder = new StaticBuilder();
        CITY_LANDMARKS[name](builder, random(1));
        const group = builder.build();
        expect(group.children.length).toBeGreaterThan(0);
        expect(vertexCount(group)).toBeGreaterThan(0);
      });

      it("stays within CELL_HALF in x and z", () => {
        const builder = new StaticBuilder();
        CITY_LANDMARKS[name](builder, random(2));
        const group = builder.build();
        const box = new THREE.Box3().setFromObject(group);
        expect(box.min.x).toBeGreaterThanOrEqual(-CELL_HALF - 1e-6);
        expect(box.max.x).toBeLessThanOrEqual(CELL_HALF + 1e-6);
        expect(box.min.z).toBeGreaterThanOrEqual(-CELL_HALF - 1e-6);
        expect(box.max.z).toBeLessThanOrEqual(CELL_HALF + 1e-6);
      });

      it("gives the same vertex count for the same seed", () => {
        const builderA = new StaticBuilder();
        CITY_LANDMARKS[name](builderA, random(42));
        const countA = vertexCount(builderA.build());

        const builderB = new StaticBuilder();
        CITY_LANDMARKS[name](builderB, random(42));
        const countB = vertexCount(builderB.build());

        expect(countA).toBe(countB);
      });
    });
  }

  // Park draws one unbroken grass plane at y = 0 over the whole scene, so
  // anything a landmark sinks below grade loses the depth test and vanishes.
  it("keeps the Goffert field and its lines above the shared ground plane", () => {
    const builder = new StaticBuilder();
    CITY_LANDMARKS.goffert(builder, random(3));
    const box = new THREE.Box3().setFromObject(builder.build());
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
  });

  it("makes the Stevenskerk the tallest city landmark", () => {
    const heights = Object.fromEntries(
      NAMES.map((name) => {
        const builder = new StaticBuilder();
        CITY_LANDMARKS[name](builder, random(7));
        const box = new THREE.Box3().setFromObject(builder.build());
        return [name, box.max.y];
      }),
    ) as Record<(typeof NAMES)[number], number>;

    for (const name of NAMES) {
      if (name === "stevenskerk") continue;
      expect(heights.stevenskerk).toBeGreaterThan(heights[name]);
    }
  });

  it("slopes both Linku roof panels upward toward the central ridge", () => {
    const angle = Math.PI / 8;
    expect(pitchedRoofRotationX(-1, angle)).toBe(-angle);
    expect(pitchedRoofRotationX(1, angle)).toBe(angle);
  });
});
