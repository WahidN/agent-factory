import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { LevelCrossings, type CrossingState } from "../level-crossing.ts";
import { RAIL_X } from "../rail-corridor.ts";

const state = (zs: number[], booms: number[]): CrossingState => ({
  crossingCount: () => zs.length,
  crossingZAt: (index) => zs[index],
  boomAt: (index) => booms[index],
});

const meshes = (crossings: LevelCrossings) => crossings.group.children as THREE.InstancedMesh[];

// Where the boom points, as a unit vector: up while open, along the track once
// it is down across the road.
function boomDirection(crossings: LevelCrossings, index: number): THREE.Vector3 {
  const matrix = new THREE.Matrix4();
  meshes(crossings)[1].getMatrixAt(index, matrix);
  const rotation = new THREE.Quaternion().setFromRotationMatrix(matrix);
  return new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
}

const postX = (crossings: LevelCrossings, index: number) => {
  const matrix = new THREE.Matrix4();
  meshes(crossings)[0].getMatrixAt(index, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix).x;
};

describe("LevelCrossings", () => {
  it("puts a post and a boom on both sides of every crossing", () => {
    const crossings = new LevelCrossings();
    crossings.update(state([30, 150], [0, 0]));
    const [posts, booms] = meshes(crossings);
    expect(posts.count).toBe(4);
    expect(booms.count).toBe(4);
    expect(postX(crossings, 0)).toBeCloseTo(RAIL_X - 7);
    expect(postX(crossings, 1)).toBeCloseTo(RAIL_X + 7);

    crossings.update(state([30], [0]));
    expect(posts.count).toBe(2); // the park shrank, so one crossing is gone
  });

  it("stands the booms up when open and lays them across the road when shut", () => {
    const crossings = new LevelCrossings();
    crossings.update(state([30], [0]));
    expect(boomDirection(crossings, 0).y).toBeCloseTo(1);
    expect(boomDirection(crossings, 1).y).toBeCloseTo(1);

    crossings.update(state([30], [1]));
    // Flat, and each boom reaches over its own half of the road.
    for (const side of [0, 1]) expect(boomDirection(crossings, side).y).toBeCloseTo(0);
    expect(boomDirection(crossings, 0).z).toBeCloseTo(-1);
    expect(boomDirection(crossings, 1).z).toBeCloseTo(1);

    crossings.update(state([30], [0.5]));
    expect(boomDirection(crossings, 0).y).toBeCloseTo(Math.cos(Math.PI / 4));
  });
});
