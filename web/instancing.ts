// Shared InstancedMesh plumbing for the crowd/prop layers (city-events.ts,
// street-life.ts): mesh setup, a seeded PRNG, claim sorting and the scratch
// objects that write one instance's transform without allocating per call.

import * as THREE from "three";
import { hashString } from "./plots.ts";

export function instancedMesh(
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  maximum: number,
  castShadow = true,
  receiveShadow = true,
) {
  const mesh = new THREE.InstancedMesh(geometry, material, maximum);
  mesh.name = name;
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

// A small, deterministic PRNG from a string seed. `multiplier`/`increment`
// pick the LCG constants, so each caller can keep its own sequence.
export function seededRandom(seed: string, multiplier = 1664525, increment = 1013904223): () => number {
  let state = hashString(seed) || 1;
  return () => {
    state = (Math.imul(state, multiplier) + increment) >>> 0;
    return state / 4294967296;
  };
}

// Every open client sees the same layout for the same claims, since draw
// order otherwise depends on Set/Map iteration order.
export function sortClaims<T extends { cell: { col: number; row: number }; amenity: string }>(
  claims: readonly T[],
): T[] {
  return [...claims].sort(
    (a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col || a.amenity.localeCompare(b.amenity),
  );
}

// The hour/busyRatio clamp shared by every CityActivity consumer: a bad
// hour falls back to noon, busyRatio is safely bounded to 0..1.
export function clampHourAndBusy(activity: { hour: number; busyRatio: number }): {
  hour: number;
  busyRatio: number;
} {
  return {
    hour: (((Number.isFinite(activity.hour) ? activity.hour : 12) % 24) + 24) % 24,
    busyRatio: THREE.MathUtils.clamp(activity.busyRatio || 0, 0, 1),
  };
}

// Writes one instance's transform (and, for setColoredMatrix, its color)
// without allocating; every call reuses the same scratch objects.
export class InstanceWriter {
  private readonly matrix = new THREE.Matrix4();
  private readonly rotation = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly color = new THREE.Color();

  setMatrix(mesh: THREE.InstancedMesh, index: number, x: number, z: number, angle: number) {
    this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
    this.matrix.compose(this.position.set(x, 0, z), this.rotation, this.scale);
    mesh.setMatrixAt(index, this.matrix);
  }

  setColoredMatrix(mesh: THREE.InstancedMesh, index: number, x: number, z: number, angle: number, color: string) {
    this.setMatrix(mesh, index, x, z, angle);
    mesh.setColorAt(index, this.color.set(color));
  }
}
