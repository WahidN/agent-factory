import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ROAD_BRIDGE_UNDERSIDE_Y, WATER_Y } from "../park.ts";
import { BOAT_MAX_Y, BOAT_VERTICAL_SCALE, RiverBoats } from "../river-boats.ts";

function hullCount(traffic: RiverBoats) {
  return (traffic.group.children[0] as THREE.InstancedMesh).count;
}

describe("RiverBoats", () => {
  it("draws nothing until the city reaches the Waal", () => {
    const traffic = new RiverBoats();
    expect(traffic.group.children.every((child) => "count" in child && child.count === 0)).toBe(true);
  });

  it("scales a bounded number of instances with the visible river", () => {
    const traffic = new RiverBoats();
    traffic.setRiver({ west: -30, east: 330, z: 90, width: 20 });
    expect(traffic.group.children.every((child) => "count" in child && child.count === 4)).toBe(true);
  });

  it("moves boats without creating more meshes", () => {
    const traffic = new RiverBoats();
    traffic.setRiver({ west: 0, east: 180, z: 90, width: 20 });
    const before = [...traffic.group.children];
    traffic.tick(5);
    expect(traffic.group.children).toEqual(before);
    expect(hullCount(traffic)).toBe(2);
  });

  it("keeps a boat's progress when setRiver is called again with the same instance count", () => {
    const traffic = new RiverBoats();
    traffic.setRiver({ west: 0, east: 180, z: 90, width: 20 });
    traffic.tick(3); // move it off its seeded starting progress
    const hulls = traffic.group.children[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    hulls.getMatrixAt(0, matrix);
    matrix.decompose(position, rotation, scale);
    const before = position.clone();

    traffic.setRiver({ west: 0, east: 180, z: 90, width: 20 });

    hulls.getMatrixAt(0, matrix);
    matrix.decompose(position, rotation, scale);
    expect(position.x).toBeCloseTo(before.x);
    expect(position.z).toBeCloseTo(before.z);
  });

  it("keeps low-profile boats below the bridge deck", () => {
    const traffic = new RiverBoats();
    traffic.setRiver({ west: 0, east: 180, z: 90, width: 20 });
    const hulls = traffic.group.children[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    hulls.getMatrixAt(0, matrix);
    matrix.decompose(position, rotation, scale);

    expect(position.y).toBeCloseTo(WATER_Y + 0.02);
    expect(scale.y).toBeCloseTo(BOAT_VERTICAL_SCALE);
    expect(position.y + BOAT_MAX_Y * scale.y).toBeLessThan(ROAD_BRIDGE_UNDERSIDE_Y);
  });
});
