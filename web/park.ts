// Shared ground of the industrial park: grass, roads, sidewalks, trees, lamps.
// Lots only draw what is inside their fence.

import * as THREE from "three";
import type { CellBuilder } from "./cell-build.ts";
import { type Amenity, type Cell, claimedUpTo, crossingAt, isWaterEdge, WAAL_EDGE, WAAL_WIDTH } from "./city-plan.ts";
import { FILLER_BUILDERS } from "./filler.ts";
import { COLORS, MATERIALS, TEXTURES, repeatUv, standard } from "./palette.ts";
import { parkBounds, parkHalfExtent } from "./park-layout.ts";
import { plotCell, PLOT_SIZE } from "./plots.ts";
import { BAKED_MATERIAL, StaticBuilder, type Vec3 } from "./static-builder.ts";

// Every amenity a claimed cell can hold, keyed by Amenity so TypeScript
// enforces that the builder modules between them cover the whole union: a
// new Amenity with no builder becomes a type error here, not a silently
// empty cell.
//
// The plan already claims the cells the Nijmegen landmarks will stand on, so
// that the layout does not shift again once they arrive. Until then they get
// a plantsoen, which is why seven amenities share one builder here.
const AMENITY_BUILDERS: Record<Amenity, CellBuilder> = {
  ...FILLER_BUILDERS,
  goffert: FILLER_BUILDERS.park,
  stevenskerk: FILLER_BUILDERS.park,
  valkhof: FILLER_BUILDERS.park,
  kronenburgerpark: FILLER_BUILDERS.park,
  waalkade: FILLER_BUILDERS.park,
  plein1944: FILLER_BUILDERS.park,
  station: FILLER_BUILDERS.park,
};

const UP_Y = new THREE.Vector3(0, 1, 0);

// A StaticBuilder that shifts, and optionally rotates around y, every piece
// a CellBuilder draws. A CellBuilder only knows
// cell-local coordinates; this is what turns that into a world position
// without every builder having to take an offset itself.
class OffsetBuilder extends StaticBuilder {
  private dx = 0;
  private dz = 0;
  private quaternion = new THREE.Quaternion();

  // Sets the offset and rotation for everything added from here on, all at
  // once, so a later call can never leave behind a stray angle or offset
  // from the piece drawn before it.
  place(dx: number, dz: number, angle = 0) {
    this.dx = dx;
    this.dz = dz;
    this.quaternion.setFromAxisAngle(UP_Y, angle);
  }

  override add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: Vec3,
    scale: Vec3 = [1, 1, 1],
    rotation: Vec3 = [0, 0, 0],
  ) {
    const pos = new THREE.Vector3(...position).applyQuaternion(this.quaternion);
    const rotated = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)).premultiply(this.quaternion);
    const euler = new THREE.Euler().setFromQuaternion(rotated);
    super.add(geometry, material, [pos.x + this.dx, pos.y, pos.z + this.dz], scale, [euler.x, euler.y, euler.z]);
  }
}

export const ROAD_WIDTH = 10;
export const YARD_HALF = 20; // the fenced yard is 40 x 40
const SIDEWALK = 2;
const ROAD_DASH_REPEAT = 7.5; // divides a 60 unit cell edge evenly

const roadMaterial = standard("#ffffff", { map: TEXTURES.road, roughness: 0.95 });
const plainRoadMaterial = standard(COLORS.road, { roughness: 0.95 });
const sidewalkMaterial = standard("#b9b8b2", { roughness: 0.95 });

// The Waal. Darker than the grass and smooth, so it catches the sky and the
// street lamps instead of reading as another field. It keeps its own material
// rather than being baked flat into the merged mesh, which is what the sheen
// needs.
const waterMaterial = standard("#0e141c", { roughness: 0.18, metalness: 0.4 });
waterMaterial.userData.separate = true;
// A flat plane this size casting its own shadow draws a dark stripe along
// the bank where it self-shadows at a grazing sun angle; the water does not
// need to cast one, only catch the sky and the lamps.
waterMaterial.userData.castShadow = false;
const quayMaterial = standard("#575a60", { roughness: 0.9 });

const WATER_Y = 0.02; // just above the ground plane, just under the roads
const QUAY_HEIGHT = 1.4;
const BRIDGE_LENGTH = WAAL_WIDTH + 4; // reaches a little onto both banks
const BRIDGE_GAP = ROAD_WIDTH / 2 + 1; // the hole a bridge leaves in a quay wall

const waterZ = (WAAL_EDGE - 0.5) * PLOT_SIZE;
const bankZ = (side: number) => waterZ + side * (WAAL_WIDTH / 2);

// The columns the river actually touches right now: at least one of the
// given cells sits on a bank in each of them. Null when nothing does yet, so
// nothing about the Waal is drawn for a city that has not reached it. The
// city plan is not rectangular (a Hilbert curve), so this is the span of the
// columns that are riverfront, not the span of every cell's column: a gap
// inside it still fills with water rather than leaving a hole in the river.
type RiverSpan = { minCol: number; maxCol: number } | null;

function riverSpan(cells: Cell[]): RiverSpan {
  const cols = cells.filter((cell) => isWaterEdge(cell.row) || isWaterEdge(cell.row + 1)).map((cell) => cell.col);
  return cols.length ? { minCol: Math.min(...cols), maxCol: Math.max(...cols) } : null;
}

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
  // The claimed cells' own contents. They change only when the city plan hands
  // out another cell, not on every session that starts, so they get their own
  // group and their own key instead of being rebuilt with the streets.
  private claims = new THREE.Group();
  private key = "";
  private claimKey = "";

  constructor(scene: THREE.Scene) {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), MATERIALS.grass);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    scene.add(grass, this.group, this.claims);
  }

  // Rebuilds only when the set of used cells changes.
  update(ranks: number[]) {
    const key = [...ranks].sort((a, b) => a - b).join(",");
    if (key === this.key) return;
    this.key = key;
    const claims = claimedUpTo(ranks.length);
    const lots = ranks.map(plotCell);
    const river = riverSpan([...lots, ...claims.map((claim) => claim.cell)]);
    this.rebuild(
      lots,
      claims.map((claim) => claim.cell),
      river,
    );
    this.rebuildClaims(claims);
  }

  // Center and half size of the park, for camera and shadows. parkBounds folds
  // in the claimed cells, so a landmark on the edge stays in frame.
  extent() {
    const bounds = parkBounds(this.key ? this.key.split(",").map(Number) : [], true);
    const x = ((bounds.minCol + bounds.maxCol) / 2) * PLOT_SIZE;
    const z = ((bounds.minRow + bounds.maxRow) / 2) * PLOT_SIZE;
    const half = parkHalfExtent(bounds, PLOT_SIZE);
    return { x, z, half };
  }

  // Streets for every cell the city uses, lots and claimed cells alike: a
  // claimed cell without roads would leave a hole in the street plan.
  private rebuild(lots: Cell[], claimed: Cell[], river: RiverSpan) {
    const cells = [...lots, ...claimed];
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
      const inner = half - ROAD_WIDTH / 2; // curb line
      const wet = [isWaterEdge(row), isWaterEdge(row + 1)] as const; // south, north

      // Everything that runs north-south stops at the quay on a bank cell:
      // past it there is river, not block.
      const clip = (reach: number): [number, number] => [
        wet[0] ? Math.max(cz - reach, bankZ(1)) : cz - reach,
        wet[1] ? Math.min(cz + reach, bankZ(-1)) : cz + reach,
      ];

      // Road edges on the cell's four sides, meeting at corner patches. The
      // edge the Waal runs along carries water instead of tarmac.
      const [roadLow, roadHigh] = clip(half);
      for (const c of [col, col + 1]) {
        once(`v:${c}:${row}`, () =>
          this.road(builder, (c - 0.5) * PLOT_SIZE, (roadLow + roadHigh) / 2, true, roadHigh - roadLow),
        );
      }
      for (const r of [row, row + 1]) {
        if (isWaterEdge(r)) continue;
        once(`h:${col}:${r}`, () => this.road(builder, cx, (r - 0.5) * PLOT_SIZE, false));
      }
      for (const c of [col, col + 1]) {
        for (const r of [row, row + 1]) {
          if (isWaterEdge(r)) continue; // that crossing is midstream; a bridge deck covers it
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

      const rand = random(col * 7919 + row * 104729 + 17);

      // Sidewalks with curbs on all four sides of the block, minus the side the
      // river took.
      const [walkLow, walkHigh] = clip(inner);
      const walkZ = (walkLow + walkHigh) / 2;
      const walkLength = walkHigh - walkLow;
      for (const side of [-1, 1]) {
        const edge = side * (inner - SIDEWALK / 2);
        builder.box(sidewalkMaterial, [cx + edge, 0.1, walkZ], [SIDEWALK, 0.2, walkLength]);
        builder.box(MATERIALS.curb, [cx + side * (inner - 0.15), 0.14, walkZ], [0.3, 0.28, walkLength]);
        if (wet[(side + 1) / 2]) continue;
        builder.box(sidewalkMaterial, [cx, 0.1, cz + edge], [inner * 2 - SIDEWALK * 2, 0.2, SIDEWALK]);
        builder.box(MATERIALS.curb, [cx, 0.14, cz + side * (inner - 0.15)], [inner * 2, 0.28, 0.3]);
      }

      // Street lamps at the four block corners, except the ones in the water.
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          if (wet[(sz + 1) / 2]) continue;
          this.lamp(builder, cx + sx * (inner - 1), cz + sz * (inner - 1), sx, sz);
        }
      }

      // Trees along the green strip between sidewalk and fence.
      const strip = (YARD_HALF + inner - SIDEWALK) / 2;
      for (let t = -inner + 5; t <= inner - 5; t += 4.5) {
        for (const side of [-1, 1]) {
          if (rand() < 0.45 && !wet[(side + 1) / 2])
            trees.push({ x: cx + t + (rand() - 0.5), z: cz + side * strip, scale: 0.8 + rand() * 0.4 });
          if (rand() < 0.45)
            trees.push({ x: cx + side * strip, z: cz + t + (rand() - 0.5), scale: 0.8 + rand() * 0.4 });
        }
      }
    }

    this.waal(builder, river);
    this.group.add(builder.build(), createTrees(trees));
    patch.dispose();
  }

  // The river, its quays and its bridges, across the columns that actually
  // have a cell on at least one bank right now. Nothing to draw at all until
  // the city reaches the water. The water is a cell edge, not a cell, so both
  // banks are riverfront and no ground is lost to it.
  private waal(builder: StaticBuilder, river: RiverSpan) {
    if (!river) return;
    const { minCol, maxCol } = river;
    const west = (minCol - 0.5) * PLOT_SIZE;
    const east = (maxCol + 0.5) * PLOT_SIZE;

    const surface = new THREE.PlaneGeometry(east - west, WAAL_WIDTH);
    builder.add(surface, waterMaterial, [(west + east) / 2, WATER_Y, waterZ], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    surface.dispose();

    // Quay walls on both banks, one run per column so a crossing can pass.
    for (let col = minCol; col <= maxCol; col++) {
      const from = (col - 0.5) * PLOT_SIZE + (crossingAt(col) ? BRIDGE_GAP : 0);
      const to = (col + 0.5) * PLOT_SIZE - (crossingAt(col + 1) ? BRIDGE_GAP : 0);
      if (to <= from) continue;
      for (const side of [-1, 1]) {
        builder.box(quayMaterial, [(from + to) / 2, 0.1, bankZ(side)], [to - from, QUAY_HEIGHT, 1.2]);
      }
    }

    // Every crossing's deck: the two named bridges and any plain one that
    // falls in range. A bridge arch appears under exactly this same
    // condition, in rebuildClaims.
    for (let col = minCol; col <= maxCol + 1; col++) {
      if (crossingAt(col)) this.bridge(builder, (col - 0.5) * PLOT_SIZE);
    }
  }

  // A flat deck from bank to bank, at road height so a car drives onto it
  // without a step. The arches come later.
  private bridge(builder: StaticBuilder, x: number) {
    builder.box(quayMaterial, [x, -0.2, waterZ], [ROAD_WIDTH + 1.6, 0.5, BRIDGE_LENGTH]);
    const deck = repeatUv(new THREE.PlaneGeometry(ROAD_WIDTH, BRIDGE_LENGTH), 1, BRIDGE_LENGTH / ROAD_DASH_REPEAT);
    builder.add(deck, roadMaterial, [x, 0.045, waterZ], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    deck.dispose();
    for (const side of [-1, 1]) {
      const rail = x + side * (ROAD_WIDTH / 2 + 0.35);
      builder.box(MATERIALS.darkSteel, [rail, 0.55, waterZ], [0.22, 1.1, BRIDGE_LENGTH]);
      builder.box(MATERIALS.darkSteel, [rail, 1.1, waterZ], [0.45, 0.14, BRIDGE_LENGTH]);
    }
  }

  // Every claimed cell's own building, drawn by its amenity's builder and
  // merged into one small group of meshes. This changes only when the city
  // plan hands out another cell, not on every session that starts, so it
  // lives here rather than in the per-session rebuild above.
  private rebuildClaims(claims: { cell: Cell; amenity: Amenity }[]) {
    const key = claims.map(({ cell, amenity }) => `${cell.col}:${cell.row}:${amenity}`).join(",");
    if (key === this.claimKey) return;
    this.claimKey = key;
    for (const child of this.claims.children) disposeTree(child);
    this.claims.clear();

    const builder = new OffsetBuilder();
    for (const { cell, amenity } of claims) {
      builder.place(cell.col * PLOT_SIZE, cell.row * PLOT_SIZE);
      const rand = random(cell.col * 7919 + cell.row * 104729 + 17);
      AMENITY_BUILDERS[amenity](builder, rand);
    }

    this.claims.add(builder.build());
  }

  // One cell edge. All roads share the textured material, so the builder
  // merges them into one mesh. The dash repeat divides the edge evenly, so
  // dashes line up where edges meet.
  private road(builder: StaticBuilder, x: number, z: number, alongZ: boolean, length = PLOT_SIZE) {
    if (length <= 0) return;
    const geometry = repeatUv(new THREE.PlaneGeometry(ROAD_WIDTH, length), 1, length / ROAD_DASH_REPEAT);
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
