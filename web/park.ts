// Shared ground of the industrial park: grass, roads, sidewalks, trees, lamps.
// Lots only draw what is inside their fence.

import * as THREE from "three";
import { COLORS, MATERIALS, TEXTURES, repeatUv, standard } from "./palette.ts";
import { parkBounds, parkHalfExtent } from "./park-layout.ts";
import { plotCell, PLOT_SIZE } from "./plots.ts";
import { BAKED_MATERIAL, StaticBuilder } from "./static-builder.ts";

export const ROAD_WIDTH = 10;
export const YARD_HALF = 20; // the fenced yard is 40 x 40
const SIDEWALK = 2;
const ROAD_DASH_REPEAT = 7.5; // divides a 60 unit cell edge evenly

const roadMaterial = standard("#ffffff", { map: TEXTURES.road, roughness: 0.95 });
const plainRoadMaterial = standard(COLORS.road, { roughness: 0.95 });
const sidewalkMaterial = standard("#b9b8b2", { roughness: 0.95 });

// Seeded random, so a cell always gets the same trees.
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Tree = { x: number; z: number; scale: number };

export class Park {
  private group = new THREE.Group();
  private key = "";

  constructor(scene: THREE.Scene) {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), MATERIALS.grass);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    scene.add(grass, this.group);
  }

  // Rebuilds only when the set of used cells changes.
  update(indexes: number[]) {
    const key = [...indexes].sort((a, b) => a - b).join(",");
    if (key === this.key) return;
    this.key = key;
    this.rebuild(indexes.map(plotCell));
  }

  // Center and half size of the park, for camera and shadows.
  extent() {
    const bounds = parkBounds(this.key ? this.key.split(",").map(Number) : []);
    const x = ((bounds.minCol + bounds.maxCol) / 2) * PLOT_SIZE;
    const z = ((bounds.minRow + bounds.maxRow) / 2) * PLOT_SIZE;
    const half = parkHalfExtent(bounds, PLOT_SIZE);
    return { x, z, half };
  }

  // Only cells with a lot get roads, sidewalks, lamps, and trees.
  private rebuild(cells: { col: number; row: number }[]) {
    for (const child of this.group.children) disposeTree(child);
    this.group.clear();

    const builder = new StaticBuilder();
    const trees: Tree[] = [];
    const half = PLOT_SIZE / 2;
    const drawn = new Set<string>(); // a road shared by two lots is drawn once
    const once = (key: string, draw: () => void) => {
      if (drawn.has(key)) return;
      drawn.add(key);
      draw();
    };
    // Flat plain squares hide crossing dashes at intersections. A plane, not a
    // box, so ambient occlusion does not draw dark lines along its edges.
    const patch = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_WIDTH);

    for (const { col, row } of cells) {
      const cx = col * PLOT_SIZE;
      const cz = row * PLOT_SIZE;

      // Road edges on the cell's four sides, meeting at corner patches.
      for (const c of [col, col + 1]) {
        once(`v:${c}:${row}`, () => this.road(builder, (c - 0.5) * PLOT_SIZE, cz, true));
      }
      for (const r of [row, row + 1]) {
        once(`h:${col}:${r}`, () => this.road(builder, cx, (r - 0.5) * PLOT_SIZE, false));
      }
      for (const c of [col, col + 1]) {
        for (const r of [row, row + 1]) {
          once(`x:${c}:${r}`, () =>
            builder.add(
              patch,
              plainRoadMaterial,
              [(c - 0.5) * PLOT_SIZE, 0.045, (r - 0.5) * PLOT_SIZE],
              [1, 1, 1],
              [-Math.PI / 2, 0, 0],
            ),
          );
        }
      }

      const inner = half - ROAD_WIDTH / 2; // curb line
      const rand = random(col * 7919 + row * 104729 + 17);

      // Sidewalks with curbs on all four sides of the block.
      for (const side of [-1, 1]) {
        const edge = side * (inner - SIDEWALK / 2);
        builder.box(sidewalkMaterial, [cx + edge, 0.1, cz], [SIDEWALK, 0.2, inner * 2]);
        builder.box(sidewalkMaterial, [cx, 0.1, cz + edge], [inner * 2 - SIDEWALK * 2, 0.2, SIDEWALK]);
        builder.box(MATERIALS.curb, [cx + side * (inner - 0.15), 0.14, cz], [0.3, 0.28, inner * 2]);
        builder.box(MATERIALS.curb, [cx, 0.14, cz + side * (inner - 0.15)], [inner * 2, 0.28, 0.3]);
      }

      // Street lamps at the four block corners.
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          this.lamp(builder, cx + sx * (inner - 1), cz + sz * (inner - 1), sx, sz);
        }
      }

      // Trees along the green strip between sidewalk and fence.
      const strip = (YARD_HALF + inner - SIDEWALK) / 2;
      for (let t = -inner + 5; t <= inner - 5; t += 4.5) {
        for (const side of [-1, 1]) {
          if (rand() < 0.45)
            trees.push({ x: cx + t + (rand() - 0.5), z: cz + side * strip, scale: 0.8 + rand() * 0.4 });
          if (rand() < 0.45)
            trees.push({ x: cx + side * strip, z: cz + t + (rand() - 0.5), scale: 0.8 + rand() * 0.4 });
        }
      }
    }

    this.group.add(builder.build(), createTrees(trees));
    patch.dispose();
  }

  // One cell edge. All roads share the textured material, so the builder
  // merges them into one mesh. The dash repeat divides the edge evenly, so
  // dashes line up where edges meet.
  private road(builder: StaticBuilder, x: number, z: number, alongZ: boolean) {
    const geometry = repeatUv(new THREE.PlaneGeometry(ROAD_WIDTH, PLOT_SIZE), 1, PLOT_SIZE / ROAD_DASH_REPEAT);
    builder.add(geometry, roadMaterial, [x, 0.03, z], [1, 1, 1], [-Math.PI / 2, 0, alongZ ? 0 : Math.PI / 2]);
    geometry.dispose();
  }

  private lamp(builder: StaticBuilder, x: number, z: number, sx: number, sz: number) {
    builder.cylinder(MATERIALS.darkSteel, [x, 3, z], [0.12, 6, 0.12]);
    const armX = x - sx * 0.9;
    const armZ = z - sz * 0.9;
    builder.box(
      MATERIALS.darkSteel,
      [(x + armX) / 2, 5.95, (z + armZ) / 2],
      [Math.abs(x - armX) + 0.15, 0.12, Math.abs(z - armZ) + 0.15],
    );
    builder.box(MATERIALS.lampHead, [armX, 5.8, armZ], [0.6, 0.18, 0.6]);
  }
}

// One pine: trunk plus three cones with baked colors, so every tree in the
// park is a single instanced draw call.
const pineGeometry = (() => {
  const builder = new StaticBuilder();
  builder.add(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 6), MATERIALS.trunk, [0, 0.6, 0]);
  builder.add(new THREE.ConeGeometry(1.5, 2.4, 7), MATERIALS.pineDark, [0, 1.9, 0]);
  builder.add(new THREE.ConeGeometry(1.15, 2, 7), MATERIALS.pineLight, [0, 3.1, 0]);
  builder.add(new THREE.ConeGeometry(0.75, 1.6, 7), MATERIALS.pineDark, [0, 4.1, 0]);
  return (builder.build().children[0] as THREE.Mesh).geometry;
})();

function createTrees(trees: Tree[]) {
  const mesh = new THREE.InstancedMesh(pineGeometry, BAKED_MATERIAL, Math.max(1, trees.length));
  mesh.count = trees.length;
  const matrix = new THREE.Matrix4();
  trees.forEach((tree, i) => {
    mesh.setMatrixAt(i, matrix.makeScale(tree.scale, tree.scale, tree.scale).setPosition(tree.x, 0, tree.z));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Frees merged geometry. The shared pine geometry and materials stay alive.
function disposeTree(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.InstancedMesh) child.dispose();
    else if (child instanceof THREE.Mesh) child.geometry.dispose();
  });
}
