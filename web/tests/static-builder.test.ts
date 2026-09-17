import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BAKED_MATERIAL, StaticBuilder } from "../static-builder.ts";

const meshesOf = (group: THREE.Group) => group.children as THREE.Mesh[];

describe("StaticBuilder", () => {
  it("bakes plain materials into one vertex colored mesh", () => {
    const builder = new StaticBuilder();
    const red = new THREE.MeshStandardMaterial({ color: "red" });
    const grey = new THREE.MeshStandardMaterial({ color: "grey" });
    for (let i = 0; i < 10; i++) builder.box(i % 2 ? red : grey, [i, 0, 0], [1, 2, 1]);

    const [mesh, ...rest] = meshesOf(builder.build());
    expect(rest).toHaveLength(0);
    expect(mesh.material).toBe(BAKED_MATERIAL);
    expect(mesh.geometry.attributes.position.count).toBe(10 * 36); // a non-indexed box has 36 vertices
    const colors = mesh.geometry.attributes.color;
    expect(colors.getX(0)).toBeCloseTo(grey.color.r);
    expect(colors.getZ(0)).toBeCloseTo(grey.color.b);
    expect(colors.getX(36)).toBeCloseTo(red.color.r);
  });

  it("keeps separate, textured, and transparent materials as their own meshes", () => {
    const builder = new StaticBuilder();
    const plain = new THREE.MeshStandardMaterial();
    const separate = new THREE.MeshStandardMaterial();
    separate.userData.separate = true;
    const textured = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const transparent = new THREE.MeshBasicMaterial({ transparent: true });
    for (const material of [plain, separate, separate, textured, transparent])
      builder.box(material, [0, 0, 0], [1, 1, 1]);

    const meshes = meshesOf(builder.build());
    expect(meshes.map((m) => m.material)).toEqual([BAKED_MATERIAL, separate, textured, transparent]);
    expect(meshes[1].geometry.attributes.color).toBeUndefined();
    expect(meshes[3].castShadow).toBe(false);
  });

  it("mixes indexed and non-indexed geometry", () => {
    const builder = new StaticBuilder();
    const material = new THREE.MeshStandardMaterial();
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1)]);
    builder.add(new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }), material, [0, 0, 0]);
    builder.cylinder(material, [2, 0, 0], [1, 1, 1]);
    expect(builder.build().children).toHaveLength(1);
  });

  it("offers a cone with its apex up, for spires and roof caps", () => {
    const builder = new StaticBuilder();
    builder.cone(new THREE.MeshStandardMaterial({ color: "red" }), [0, 10, 0], [2, 4, 2]);
    const [mesh] = meshesOf(builder.build());
    const box = new THREE.Box3().setFromObject(mesh);
    expect(box.min.y).toBeCloseTo(8);
    expect(box.max.y).toBeCloseTo(12);
    // The apex is a single point: at the top there is no width, at the base there is.
    const pos = mesh.geometry.attributes.position;
    let topSpread = 0;
    for (let i = 0; i < pos.count; i++)
      if (Math.abs(pos.getY(i) - 12) < 1e-6) topSpread = Math.max(topSpread, Math.abs(pos.getX(i)));
    expect(topSpread).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(2);
  });

  it("applies position and scale", () => {
    const builder = new StaticBuilder();
    builder.box(new THREE.MeshStandardMaterial(), [5, 1, 0], [2, 2, 2]);
    const mesh = meshesOf(builder.build())[0];
    mesh.geometry.computeBoundingBox();
    expect(mesh.geometry.boundingBox!.min.toArray()).toEqual([4, 0, -1]);
    expect(mesh.geometry.boundingBox!.max.toArray()).toEqual([6, 2, 1]);
  });
});
