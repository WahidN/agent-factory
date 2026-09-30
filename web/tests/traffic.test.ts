import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ParkTraffic, type TrafficSource } from "../traffic.ts";

// The instance scale is the vehicle's presence, so it reads the fade.
function carScale(traffic: ParkTraffic): number {
  const bodies = traffic.group.children[0] as THREE.InstancedMesh;
  if (bodies.count === 0) return 0;
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
    const scales: number[] = [];
    for (let i = 0; i < 3000; i++) {
      traffic.tick(1 / 30, source);
      scales.push(carScale(traffic));
      expect(carCount(traffic)).toBeLessThanOrEqual(1); // never two cars in one slot
    }
    expect(scales.filter((scale) => scale < 0.05).length).toBeGreaterThan(0);
    expect(scales.filter((scale) => scale > 0.95).length).toBeGreaterThan(scales.length / 2);
  });

  it("keeps a car driving where the roads run on", () => {
    const traffic = new ParkTraffic();
    traffic.setRoads(Array.from({ length: 60 }, (_, rank) => rank));
    for (let i = 0; i < 60; i++) traffic.tick(1 / 30, source);
    expect(carScale(traffic)).toBeGreaterThan(0.95);
  });
});
