import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CELL_HALF } from "../cell-build.ts";
import { FILLER_BUILDERS } from "../filler.ts";
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

describe("FILLER_BUILDERS", () => {
  for (const archetype of ["park", "houses", "shops", "field"] as const) {
    describe(archetype, () => {
      it("builds without throwing and produces geometry", () => {
        const builder = new StaticBuilder();
        FILLER_BUILDERS[archetype](builder, random(1));
        const group = builder.build();
        expect(group.children.length).toBeGreaterThan(0);
        expect(vertexCount(group)).toBeGreaterThan(0);
      });

      it("stays within CELL_HALF in x and z", () => {
        const builder = new StaticBuilder();
        FILLER_BUILDERS[archetype](builder, random(2));
        const group = builder.build();
        const box = new THREE.Box3().setFromObject(group);
        expect(box.min.x).toBeGreaterThanOrEqual(-CELL_HALF - 1e-6);
        expect(box.max.x).toBeLessThanOrEqual(CELL_HALF + 1e-6);
        expect(box.min.z).toBeGreaterThanOrEqual(-CELL_HALF - 1e-6);
        expect(box.max.z).toBeLessThanOrEqual(CELL_HALF + 1e-6);
      });

      it("gives the same vertex count for the same seed", () => {
        const builderA = new StaticBuilder();
        FILLER_BUILDERS[archetype](builderA, random(42));
        const countA = vertexCount(builderA.build());

        const builderB = new StaticBuilder();
        FILLER_BUILDERS[archetype](builderB, random(42));
        const countB = vertexCount(builderB.build());

        expect(countA).toBe(countB);
      });
    });
  }
});
