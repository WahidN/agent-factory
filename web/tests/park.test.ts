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

describe("Park and the Waal", () => {
  it("draws no water for a city that does not reach the river", () => {
    // One session sits on row 0 with the Goffert beside it; the nearest bank
    // is two cell rows north, so nothing the park draws may get there.
    const { park, streets } = parkInScene();
    park.update([0]);
    const box = new THREE.Box3().setFromObject(streets);
    expect(box.max.z).toBeLessThan(southBank);
  });

  it("keeps a claimed cell's own buildings out of the water", () => {
    const { park, claims } = parkInScene();
    park.update([0]);
    const box = new THREE.Box3().setFromObject(claims);
    expect(box.max.z).toBeLessThan(southBank);
  });
});
