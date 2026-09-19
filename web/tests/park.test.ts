import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { RAIL_BRIDGE, WAAL_EDGE, WAAL_WIDTH } from "../city-plan.ts";
import { Park, WATER_Y } from "../park.ts";
import { COLORS, TEXTURES } from "../palette.ts";
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
  it("recesses the water below street and bridge level", () => {
    expect(WATER_Y).toBeLessThan(-0.5);
  });

  it("uses a textured green meadow for the surrounding terrain", () => {
    const scene = new THREE.Scene();
    new Park(scene);
    const terrain = scene.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(terrain.material.map).toBe(TEXTURES.grass);
    expect(new THREE.Color(COLORS.grass).getHSL({ h: 0, s: 0, l: 0 }).s).toBeGreaterThan(0.2);
  });

  it("renders the Waal with the shared blue water material", () => {
    const { park, streets } = parkInScene();
    park.update(ranks(6));
    let river: THREE.MeshStandardMaterial | undefined;
    streets.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        if (child.material.map === TEXTURES.water) river = child.material;
      }
    });
    expect(river).toBeDefined();
    expect(river!.color.getHexString()).toBe(new THREE.Color(COLORS.water).getHexString());
  });

  it("draws no water for a city that does not reach the river", () => {
    // The dry channel cover may reach the future river strip, but the blue
    // water material itself must not exist before the city reaches a bank.
    const { park, streets } = parkInScene();
    park.update([0]);
    let hasWater = false;
    streets.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        if (child.material.map === TEXTURES.water) hasWater = true;
      }
    });
    expect(hasWater).toBe(false);
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

  it("places the fixed Spoorbrug between the two road bridges", () => {
    const { park, claims } = parkInScene();
    park.update(ranks(6));
    const railX = (RAIL_BRIDGE.col - 0.5) * PLOT_SIZE;
    let railTop = Number.NEGATIVE_INFINITY;

    claims.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const positions = child.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        if (Math.abs(positions.getX(i) - railX) < 5 && Math.abs(positions.getZ(i) - waterZ) < 19) {
          railTop = Math.max(railTop, positions.getY(i));
        }
      }
    });

    expect(railTop).toBeGreaterThan(10);
  });
});
