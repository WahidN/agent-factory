import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CELL_HALF } from "../cell-build.ts";
import { WAAL_WIDTH } from "../city-plan.ts";
import { bridgeArch, gladiolaArch, railBridge, RIVER_LANDMARKS } from "../landmarks-river.ts";
import { StaticBuilder } from "../static-builder.ts";

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

describe("RIVER_LANDMARKS", () => {
  for (const name of ["valkhof", "waalkade"] as const) {
    describe(name, () => {
      it("builds without throwing and produces geometry", () => {
        const builder = new StaticBuilder();
        RIVER_LANDMARKS[name](builder, random(1));
        const group = builder.build();
        expect(group.children.length).toBeGreaterThan(0);
        expect(vertexCount(group)).toBeGreaterThan(0);
      });

      it("stays within CELL_HALF in x and z", () => {
        const builder = new StaticBuilder();
        RIVER_LANDMARKS[name](builder, random(2));
        const group = builder.build();
        const box = new THREE.Box3().setFromObject(group);
        expect(box.min.x).toBeGreaterThanOrEqual(-CELL_HALF - 1e-6);
        expect(box.max.x).toBeLessThanOrEqual(CELL_HALF + 1e-6);
        expect(box.min.z).toBeGreaterThanOrEqual(-CELL_HALF - 1e-6);
        expect(box.max.z).toBeLessThanOrEqual(CELL_HALF + 1e-6);
      });
    });
  }

  it("keeps the Waalkade paving above the meadow plane", () => {
    const builder = new StaticBuilder();
    RIVER_LANDMARKS.waalkade(builder, random(3));
    const box = new THREE.Box3().setFromObject(builder.build());
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
  });
});

describe("bridgeArch", () => {
  for (const kind of ["oversteek", "waalbrug"] as const) {
    it(`${kind} reaches beyond the water on both banks`, () => {
      const builder = new StaticBuilder();
      bridgeArch(builder, kind);
      const group = builder.build();
      const box = new THREE.Box3().setFromObject(group);
      expect(box.max.z - box.min.z).toBeGreaterThan(WAAL_WIDTH);
    });
  }

  it("builds the same geometry deterministically", () => {
    const builderA = new StaticBuilder();
    bridgeArch(builderA, "waalbrug");
    const countA = vertexCount(builderA.build());

    const builderB = new StaticBuilder();
    bridgeArch(builderB, "waalbrug");
    const countB = vertexCount(builderB.build());

    expect(countA).toBe(countB);
  });

  it("draws visibly different bridges for the two kinds", () => {
    const waalbrugBuilder = new StaticBuilder();
    bridgeArch(waalbrugBuilder, "waalbrug");
    const waalbrugBox = new THREE.Box3().setFromObject(waalbrugBuilder.build());

    const oversteekBuilder = new StaticBuilder();
    bridgeArch(oversteekBuilder, "oversteek");
    const oversteekBox = new THREE.Box3().setFromObject(oversteekBuilder.build());

    // The waalbrug's symmetric arch peaks in the middle of the water, so its
    // highest point sits near z = 0. The oversteek's asymmetric arch climbs
    // steeply on one side, so its peak sits well off-center.
    expect(waalbrugBox.max.y).not.toBeCloseTo(oversteekBox.max.y, 0);
  });
});

describe("railBridge", () => {
  it("builds a distinct fixed span that reaches both banks", () => {
    const builder = new StaticBuilder();
    railBridge(builder);
    const group = builder.build();
    const box = new THREE.Box3().setFromObject(group);

    expect(group.children.length).toBeGreaterThan(0);
    expect(box.max.z - box.min.z).toBeGreaterThan(WAAL_WIDTH);
    expect(box.max.y).toBeGreaterThan(10);
  });

  it("has a different geometry signature from both road bridges", () => {
    const railBuilder = new StaticBuilder();
    railBridge(railBuilder);
    const railVertices = vertexCount(railBuilder.build());

    for (const kind of ["oversteek", "waalbrug"] as const) {
      const roadBuilder = new StaticBuilder();
      bridgeArch(roadBuilder, kind);
      expect(railVertices).not.toBe(vertexCount(roadBuilder.build()));
    }
  });
});

describe("gladiolaArch", () => {
  it("leaves at least 6 of clearance over the road", () => {
    const builder = new StaticBuilder();
    gladiolaArch(builder);
    const group = builder.build();

    // Sample the clearance directly under the arch (near x = 0) by checking
    // that nothing from the arch structure occupies y < 6 within the road
    // width (x between -5 and 5).
    const box = new THREE.Box3().setFromObject(group);
    // The pillars sit outside the 10-wide road; the low point of the span
    // itself must clear 6.
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
    // Find the lowest point of anything spanning across x = 0.
    const positions: number[] = [];
    for (const child of group.children) {
      const mesh = child as THREE.Mesh;
      const geometry = mesh.geometry;
      const attr = geometry.attributes.position;
      for (let i = 0; i < attr.count; i++) {
        const x = attr.getX(i);
        if (Math.abs(x) < 4.9) positions.push(attr.getY(i));
      }
    }
    const minYOverRoad = Math.min(...positions);
    expect(minYOverRoad).toBeGreaterThanOrEqual(6);
  });
});
