import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CELL_HALF } from "../cell-build.ts";
import { buildDistrictFiller, districtForCell, districtVariant, type FillerAmenity } from "../district-style.ts";
import { StaticBuilder } from "../static-builder.ts";

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function build(amenity: FillerAmenity, cell: { col: number; row: number }) {
  const builder = new StaticBuilder();
  buildDistrictFiller(amenity, builder, random(42), cell);
  return builder.build();
}

function signature(group: THREE.Group) {
  let vertices = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) vertices += child.geometry.attributes.position.count;
  });
  const bounds = new THREE.Box3().setFromObject(group);
  return `${vertices}:${bounds.min.x.toFixed(3)}:${bounds.max.y.toFixed(3)}:${bounds.max.z.toFixed(3)}`;
}

describe("Nijmegen district grammar", () => {
  it("maps old city, Oost, Waalsprong and the green edge", () => {
    expect(districtForCell({ col: 1, row: 1 })).toBe("benedenstad");
    expect(districtForCell({ col: 6, row: 1 })).toBe("oost");
    expect(districtForCell({ col: 4, row: 3 })).toBe("waalsprong");
    expect(districtForCell({ col: 11, row: 7 })).toBe("stadsrand");
  });

  it("keeps cell variants deterministic and bounded", () => {
    for (let col = -4; col < 20; col++) {
      const first = districtVariant({ col, row: col % 8 }, 3);
      expect(districtVariant({ col, row: col % 8 }, 3)).toBe(first);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThan(3);
    }
  });

  it("builds the same district geometry for the same seed", () => {
    const cell = { col: 4, row: 3 };
    expect(signature(build("houses", cell))).toBe(signature(build("houses", cell)));
  });

  it("keeps every decorated filler composition inside its cell", () => {
    const samples = [
      { col: 1, row: 1 },
      { col: 6, row: 1 },
      { col: 4, row: 3 },
      { col: 12, row: 8 },
    ];
    for (const cell of samples) {
      for (const amenity of ["park", "houses", "shops", "field"] as const) {
        const bounds = new THREE.Box3().setFromObject(build(amenity, cell));
        expect(bounds.min.x).toBeGreaterThanOrEqual(-CELL_HALF - 1e-6);
        expect(bounds.max.x).toBeLessThanOrEqual(CELL_HALF + 1e-6);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-CELL_HALF - 1e-6);
        expect(bounds.max.z).toBeLessThanOrEqual(CELL_HALF + 1e-6);
      }
    }
  });

  it("keeps a decorated park or field in one baked draw call", () => {
    expect(build("park", { col: 4, row: 3 }).children).toHaveLength(1);
    expect(build("field", { col: 12, row: 8 }).children).toHaveLength(1);
  });
});
