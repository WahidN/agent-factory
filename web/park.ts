// Shared ground of the industrial park: grass, roads, sidewalks, trees, lamps.
// Lots only draw what is inside their fence.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CellBuilder } from "./cell-build.ts";
import {
  type Amenity,
  BRIDGES,
  type Cell,
  claimedUpTo,
  crossingAt,
  GLADIOLA,
  isWaterEdge,
  RAIL_BRIDGE,
  WAAL_EDGE,
  WAAL_WIDTH,
} from "./city-plan.ts";
import { FILLER_BUILDERS } from "./filler.ts";
import { buildDistrictFiller, isFillerAmenity } from "./district-style.ts";
import { CITY_LANDMARKS } from "./landmarks-city.ts";
import { bridgeArch, gladiolaArch, railBridge, RIVER_LANDMARKS } from "./landmarks-river.ts";
import { COLORS, MATERIALS, TEXTURES, repeatUv, standard } from "./palette.ts";
import { parkBounds, parkHalfExtent } from "./park-layout.ts";
import { plotCell, PLOT_SIZE } from "./plots.ts";
import { appendRailCorridor } from "./rail-corridor.ts";
import { BAKED_MATERIAL, StaticBuilder, type Vec3 } from "./static-builder.ts";
import { appendTerrainRelief } from "./terrain.ts";

// Every amenity a claimed cell can hold, keyed by Amenity so TypeScript
// enforces that the three builder modules between them cover the whole
// union: a new Amenity with no builder becomes a type error here, not a
// silently empty cell.
const AMENITY_BUILDERS: Record<Amenity, CellBuilder> = {
  ...FILLER_BUILDERS,
  ...CITY_LANDMARKS,
  ...RIVER_LANDMARKS,
};

const UP_Y = new THREE.Vector3(0, 1, 0);

// A StaticBuilder that shifts, and optionally rotates around y, every piece
// a CellBuilder or bridgeArch/gladiolaArch draws. A CellBuilder only knows
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
const terrainMaterial = standard("#ffffff", { map: TEXTURES.grass, roughness: 1 });

// The Waal stays unmistakably blue in daylight. A shared static current
// texture supplies detail without an animated shader or extra geometry.
const waterMaterial = standard(COLORS.water, { map: TEXTURES.water, roughness: 0.28, metalness: 0.08 });
waterMaterial.userData.separate = true;
// A flat plane this size casting its own shadow draws a dark stripe along
// the bank where it self-shadows at a grazing sun angle; the water does not
// need to cast one, only catch the sky and the lamps.
waterMaterial.userData.castShadow = false;
const quayMaterial = standard("#777b79", { roughness: 0.92 });

export const WATER_Y = -1.35;
export const ROAD_BRIDGE_UNDERSIDE_Y = -0.45;
const CHANNEL_FLOOR_Y = -1.7;
const QUAY_TOP_Y = 1;
const QUAY_HEIGHT = QUAY_TOP_Y - CHANNEL_FLOOR_Y;
const QUAY_CENTER_Y = (QUAY_TOP_Y + CHANNEL_FLOOR_Y) / 2;
const BRIDGE_LENGTH = WAAL_WIDTH + 4; // reaches a little onto both banks
const BRIDGE_GAP = ROAD_WIDTH / 2 + 1; // the hole a bridge leaves in a quay wall

const waterZ = (WAAL_EDGE - 0.5) * PLOT_SIZE;
const bankZ = (side: number) => waterZ + side * (WAAL_WIDTH / 2);
const bridgeGapAt = (col: number) => crossingAt(col) !== null || col === RAIL_BRIDGE.col;

function meadowGeometry() {
  const edge = 3000;
  const southLength = bankZ(-1) + edge;
  const northLength = edge - bankZ(1);
  const pieces = [
    new THREE.PlaneGeometry(edge * 2, southLength).rotateX(-Math.PI / 2).translate(0, 0, -edge + southLength / 2),
    new THREE.PlaneGeometry(edge * 2, WAAL_WIDTH).rotateX(-Math.PI / 2).translate(0, CHANNEL_FLOOR_Y, waterZ),
    new THREE.PlaneGeometry(edge * 2, northLength).rotateX(-Math.PI / 2).translate(0, 0, bankZ(1) + northLength / 2),
  ];
  const merged = mergeGeometries(pieces)!;
  for (const piece of pieces) piece.dispose();
  return merged;
}

// The columns the river actually touches right now: at least one of the
// given cells sits on a bank in each of them. Null when nothing does yet, so
// nothing about the Waal is drawn for a city that has not reached it. The
// city plan is not rectangular (a Hilbert curve), so this is the span of the
// columns that are riverfront, not the span of every cell's column: a gap
// inside it still fills with water rather than leaving a hole in the river.
type RiverSpan = { minCol: number; maxCol: number } | null;

export type RiverBounds = { west: number; east: number; z: number; width: number };

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
  private river: RiverSpan = null;

  constructor(scene: THREE.Scene) {
    const grass = new THREE.Mesh(meadowGeometry(), terrainMaterial);
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
    this.river = river;
    this.rebuild(
      lots,
      claims.map((claim) => claim.cell),
      river,
    );
    this.rebuildClaims(claims, river);
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

  riverBounds(): RiverBounds | null {
    if (!this.river) return null;
    return {
      west: (this.river.minCol - 0.5) * PLOT_SIZE,
      east: (this.river.maxCol + 0.5) * PLOT_SIZE,
      z: waterZ,
      width: WAAL_WIDTH,
    };
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
        if (c === RAIL_BRIDGE.col) continue;
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
        const boundaryCol = side < 0 ? col : col + 1;
        const edge = side * (inner - SIDEWALK / 2);
        if (boundaryCol !== RAIL_BRIDGE.col) {
          builder.box(sidewalkMaterial, [cx + edge, 0.1, walkZ], [SIDEWALK, 0.2, walkLength]);
          builder.box(MATERIALS.curb, [cx + side * (inner - 0.15), 0.14, walkZ], [0.3, 0.28, walkLength]);
        }
        if (wet[(side + 1) / 2]) continue;
        builder.box(sidewalkMaterial, [cx, 0.1, cz + edge], [inner * 2 - SIDEWALK * 2, 0.2, SIDEWALK]);
        builder.box(MATERIALS.curb, [cx, 0.14, cz + side * (inner - 0.15)], [inner * 2, 0.28, 0.3]);
      }

      // Street lamps at the four block corners, except the ones in the water.
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          if (wet[(sz + 1) / 2]) continue;
          if ((sx < 0 ? col : col + 1) === RAIL_BRIDGE.col) continue;
          this.lamp(builder, cx + sx * (inner - 1), cz + sz * (inner - 1), sx, sz);
        }
      }

      // Trees along the green strip between sidewalk and fence.
      const strip = (YARD_HALF + inner - SIDEWALK) / 2;
      for (let t = -inner + 5; t <= inner - 5; t += 4.5) {
        for (const side of [-1, 1]) {
          if (rand() < 0.45 && !wet[(side + 1) / 2])
            trees.push({ x: cx + t + (rand() - 0.5), z: cz + side * strip, scale: 0.8 + rand() * 0.4 });
          if (rand() < 0.45 && (side < 0 ? col : col + 1) !== RAIL_BRIDGE.col)
            trees.push({ x: cx + side * strip, z: cz + t + (rand() - 0.5), scale: 0.8 + rand() * 0.4 });
        }
      }
    }

    appendRailCorridor(builder, cells);
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
      const from = (col - 0.5) * PLOT_SIZE + (bridgeGapAt(col) ? BRIDGE_GAP : 0);
      const to = (col + 0.5) * PLOT_SIZE - (bridgeGapAt(col + 1) ? BRIDGE_GAP : 0);
      if (to <= from) continue;
      for (const side of [-1, 1]) {
        builder.box(quayMaterial, [(from + to) / 2, QUAY_CENTER_Y, bankZ(side)], [to - from, QUAY_HEIGHT, 1.2]);
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
  // merged into one small group of meshes, plus the bridge arches and the
  // gladiolenboog: fixed city structure that does not belong to any one
  // cell. All of this changes only when the city plan hands out another
  // cell, not on every session that starts, so it lives here rather than in
  // the per-session rebuild above.
  private rebuildClaims(claims: { cell: Cell; amenity: Amenity }[], river: RiverSpan) {
    const key = `${claims.map(({ cell, amenity }) => `${cell.col}:${cell.row}:${amenity}`).join(",")}|${
      river ? `${river.minCol}:${river.maxCol}` : "none"
    }`;
    if (key === this.claimKey) return;
    this.claimKey = key;
    for (const child of this.claims.children) disposeTree(child);
    this.claims.clear();

    const builder = new OffsetBuilder();
    for (const { cell, amenity } of claims) {
      builder.place(cell.col * PLOT_SIZE, cell.row * PLOT_SIZE, amenity === "station" ? Math.PI / 2 : 0);
      const rand = random(cell.col * 7919 + cell.row * 104729 + 17);
      if (isFillerAmenity(amenity)) buildDistrictFiller(amenity, builder, rand, cell);
      else AMENITY_BUILDERS[amenity](builder, rand);
    }

    // Relief uses world coordinates. Reset the OffsetBuilder first so the
    // last claimed cell cannot accidentally offset the riverbank features.
    builder.place(0, 0);
    appendTerrainRelief(
      builder,
      claims.map(({ cell }) => cell),
      river,
    );

    // A named bridge's arch appears under the exact same condition as its
    // deck (see waal()): only once a cell on either side of it is actually
    // part of the city.
    for (const { col, kind } of BRIDGES) {
      if (!river || col < river.minCol || col > river.maxCol + 1) continue;
      builder.place((col - 0.5) * PLOT_SIZE, waterZ);
      bridgeArch(builder, kind);
    }

    // The Spoorbrug shares the river but not the road graph. Its complete rail
    // deck and truss live here with the other fixed structures; waal() only
    // leaves the corresponding opening in the quay wall.
    if (river && RAIL_BRIDGE.col >= river.minCol && RAIL_BRIDGE.col <= river.maxCol + 1) {
      builder.place((RAIL_BRIDGE.col - 0.5) * PLOT_SIZE, waterZ);
      railBridge(builder);
    }

    // The gladiolenboog only stands once the cell it spans is actually part
    // of the city; that cell is Plein 1944, on the far side of GLADIOLA's
    // road. bridgeArch's deck runs along z, matching bridge()'s own deck, so
    // it needs no rotation; the gladiolenboog is built for a road whose
    // width runs along x (a north-south, column-boundary road), but GLADIOLA
    // sits on a south, row-boundary edge, whose road runs east-west with its
    // width along z instead, so it is rotated a quarter turn to fit.
    if (claims.some(({ cell }) => cell.col === GLADIOLA.col && cell.row === GLADIOLA.row)) {
      builder.place(GLADIOLA.col * PLOT_SIZE, (GLADIOLA.row - 0.5) * PLOT_SIZE, Math.PI / 2);
      gladiolaArch(builder);
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
