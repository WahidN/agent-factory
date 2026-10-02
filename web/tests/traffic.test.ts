import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ParkTraffic, type TrafficSource } from "../traffic.ts";

// The instance's alpha is the vehicle's presence, so it reads the fade.
function carFade(traffic: ParkTraffic): number {
  const bodies = traffic.group.children[0] as THREE.InstancedMesh;
  if (bodies.count === 0) return 0;
  return bodies.geometry.getAttribute("aFade").getX(0);
}

// A car fades out at its own size, so the instance never shrinks.
function carScale(traffic: ParkTraffic): number {
  const bodies = traffic.group.children[0] as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4();
  bodies.getMatrixAt(0, matrix);
  return new THREE.Vector3().setFromMatrixScale(matrix).x;
}

const carCount = (traffic: ParkTraffic) => (traffic.group.children[0] as THREE.InstancedMesh).count;

describe("ParkTraffic", () => {
  // Rank 0 sits against the rail corridor, which carries no road, so its east
  // road ends there. A car sent onto it runs out of lane within a minute.
  const source: TrafficSource[] = [{ id: "a", index: 0, cars: 1, truck: false }];

  it("fades a car out where the road ends and sends a new one", () => {
    const traffic = new ParkTraffic();
    traffic.setRoads([0]);
    const fades: number[] = [];
    for (let i = 0; i < 3000; i++) {
      traffic.tick(1 / 30, source);
      fades.push(carFade(traffic));
      expect(carCount(traffic)).toBeLessThanOrEqual(1); // never two cars in one slot
      if (carCount(traffic) > 0) expect(carScale(traffic)).toBeCloseTo(1);
    }
    expect(fades.filter((fade) => fade < 0.05).length).toBeGreaterThan(0);
    expect(fades.filter((fade) => fade > 0.95).length).toBeGreaterThan(fades.length / 2);
  });

  it("keeps a car driving where the roads run on", () => {
    const traffic = new ParkTraffic();
    traffic.setRoads(Array.from({ length: 60 }, (_, rank) => rank));
    for (let i = 0; i < 60; i++) traffic.tick(1 / 30, source);
    expect(carFade(traffic)).toBeGreaterThan(0.95);
  });
});
