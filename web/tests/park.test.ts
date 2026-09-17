import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WAAL_EDGE, WAAL_WIDTH } from "../city-plan.ts";
import { Park } from "../park.ts";
import { PLOT_SIZE } from "../plots.ts";

const waterZ = (WAAL_EDGE - 0.5) * PLOT_SIZE;
const southBank = waterZ - WAAL_WIDTH / 2;

// The Park constructor adds the grass, then its street group, then its
// claims group, in that order.
function parkInScene() {
  const scene = new THREE.Scene();
  const park = new Park(scene);
  const [, streets, claims] = scene.children;
  return { park, streets, claims };
}

function vertexCount(object: THREE.Object3D) {
  let sum = 0;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) sum += child.geometry.attributes.position.count;
  });
  return sum;
}

const ranks = (count: number) => Array.from({ length: count }, (_, i) => i);

describe("Park and the Waal", () => {
  it("draws no water for a city that does not reach the river", () => {
    // One session sits on row 0 with the Goffert beside it; the nearest bank
    // is two cell rows north, so nothing the park draws may get there.
    const { park, streets } = parkInScene();
    park.update([0]);
    const box = new THREE.Box3().setFromObject(streets);
    expect(box.max.z).toBeLessThan(southBank);
  });

  it("puts no bridge arch over a city without a river", () => {
    const { park, claims } = parkInScene();
    park.update([0]);
    const box = new THREE.Box3().setFromObject(claims);
    expect(box.max.z).toBeLessThan(southBank);
  });

  it("grows its bridges with the city, also when the claimed cells do not change", () => {
    // At five and at six sessions the plan has claimed exactly the same
    // cells, but the sixth lot is the first to reach the column the Waalbrug
    // crosses, so its arch has to appear anyway.
    const { park, claims } = parkInScene();
    park.update(ranks(5));
    const before = vertexCount(claims);
    park.update(ranks(6));
    expect(vertexCount(claims)).toBeGreaterThan(before);
  });
});
