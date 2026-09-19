// The far level of detail: every lot that is not one of the nearest few is
// drawn from a handful of shared instanced meshes instead of its own hundreds
// of meshes.
//
// A fixed handful of draw calls covers the whole park, however many lots
// there are: one yard slab, one hall per model tier (four), two silhouette
// masses, and one roof beacon. The scene is drawn several times per frame
// (main pass, shadow map, and GTAO's depth and normal passes), so every draw
// call saved here is saved four or five times.
//
// Colors that differ per lot ride along as per-instance data: the wall tint
// through setColorAt, and the 0..1 busy value through an own
// InstancedBufferAttribute wired into the standard material with
// onBeforeCompile. Animating the glow is then one buffer upload per frame
// rather than a material per lot.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Activity } from "./activity.ts";
import { factoryStyleFor, resolveRoofMasses } from "./factory-style.ts";
import { hallShape } from "./lot.ts";
import type { ModelTier } from "./model-tier.ts";
import { COLORS } from "./palette.ts";
import { YARD_HALF } from "./park.ts";

export type FarLot = {
  id: string;
  tier: ModelTier;
  x: number;
  z: number;
  wall: THREE.Color;
  accent: THREE.Color;
  busy: boolean;
};

const TIERS: ModelTier[] = ["small", "medium", "large", "huge"];
const YARD_Y = 0.2;
const MIN_CAPACITY = 32;

// The beacon has to read at the zoom a 150 lot park needs, where one world
// unit is about one and a half pixels. Anything smaller than this disappears.
const BEACON = { size: 4, height: 1.4 };

// Idle lots glow faintly so they never read as empty ground; busy lots glow
// hard enough to pick out from across the park.
const BEACON_IDLE = 0.55;
const BEACON_BUSY = 2.1;
// The lit windows of a busy hall, in the same warm light the detailed lot
// uses. The detailed hall only lights its window panes; here the glow lands on
// the whole wall, so it has to stay low or it washes the wall tint out to
// cream (it did, at 0.5).
const HALL_BUSY_GLOW = 0.14;

function glsl(value: number): string {
  return value.toFixed(4);
}

// Feeds the per-instance busy value into a standard material. `color` is a
// GLSL expression for a vec3: a literal for the hall's window light,
// `vColor.rgb` for the beacon, which is the instance's own accent. Note the
// swizzle: three declares vColor as a vec4, so the bare name does not add to
// the vec3 totalEmissiveRadiance.
function addBusyGlow(material: THREE.MeshStandardMaterial, color: string, idle: number, lit: number) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aBusy;\nvarying float vBusy;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvBusy = aBusy;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vBusy;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
\ttotalEmissiveRadiance += ${color} * (${glsl(idle)} + ${glsl(lit - idle)} * vBusy);`,
      );
  };
  return material;
}

function literal(color: THREE.Color): string {
  return `vec3(${glsl(color.r)}, ${glsl(color.g)}, ${glsl(color.b)})`;
}

// A box, as a standalone geometry ready to merge.
function box(width: number, height: number, depth: number, x: number, y: number, z: number) {
  return new THREE.BoxGeometry(width, height, depth).translate(x, y, z);
}

// A flat shade baked into the vertices. It multiplies with the instance color
// rather than replacing it, so a darker roof stays the same hall's color.
function shade(geometry: THREE.BufferGeometry, amount: number) {
  const values = new Float32Array(geometry.attributes.position.count * 3).fill(amount);
  geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
  return geometry;
}

// The hall as one merged volume: the walls, plus a slightly wider, darker roof
// slab that reads as the flat roof and its parapet from above.
const ROOF_SHADE = 0.68;

function hallGeometry(tier: ModelTier): THREE.BufferGeometry {
  const { x0, z0, x1, z1, top } = hallShape(tier);
  const width = x1 - x0;
  const depth = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  return mergeGeometries([
    shade(box(width, top - YARD_Y, depth, cx, YARD_Y + (top - YARD_Y) / 2, cz), 1),
    shade(box(width + 0.8, 0.8, depth + 0.8, cx, top + 0.4, cz), ROOF_SHADE),
  ]);
}

function rooflineMatrix(lot: FarLot, massIndex: number, matrix: THREE.Matrix4): THREE.Matrix4 {
  const { x0, z0, x1, z1, top } = hallShape(lot.tier);
  const mass = resolveRoofMasses(factoryStyleFor(lot.id), x1 - x0, z1 - z0)[massIndex];
  return matrix.compose(
    new THREE.Vector3(
      lot.x + (x0 + x1) / 2 + mass.x,
      top + 0.8 + mass.elevation + mass.height / 2,
      lot.z + (z0 + z1) / 2 + mass.z,
    ),
    new THREE.Quaternion(),
    new THREE.Vector3(mass.width, mass.height, mass.depth),
  );
}

// Where the beacon sits: the middle of the roof of the tier's hall.
function beaconMatrix(lot: FarLot, matrix: THREE.Matrix4): THREE.Matrix4 {
  const { tier, x, z, id } = lot;
  const { x0, z0, x1, z1, top } = hallShape(tier);
  const masses = resolveRoofMasses(factoryStyleFor(id), x1 - x0, z1 - z0);
  const highest = masses.reduce((best, mass) =>
    mass.elevation + mass.height > best.elevation + best.height ? mass : best,
  );
  return matrix.makeTranslation(
    x + (x0 + x1) / 2,
    top + 0.8 + highest.elevation + highest.height + BEACON.height / 2,
    z + (z0 + z1) / 2,
  );
}

// One instanced mesh that grows when the park outgrows it. Three.js fixes an
// InstancedMesh's capacity at construction, so growing means building a new
// one; that happens a handful of times as a park fills up, never per frame.
class Slab {
  mesh: THREE.InstancedMesh;
  private busyAttribute!: THREE.InstancedBufferAttribute;

  constructor(
    private readonly geometry: THREE.BufferGeometry,
    private readonly material: THREE.Material,
    private readonly parent: THREE.Group,
    private readonly glows: boolean,
  ) {
    this.mesh = this.build(MIN_CAPACITY);
  }

  private build(capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Instances are spread over the whole park; a bounding sphere taken from
    // the geometry alone would cull the lot away from every angle.
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.glows) {
      this.busyAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      this.busyAttribute.setUsage(THREE.DynamicDrawUsage);
      // The geometry is this mesh's own, so the attribute never leaks into
      // another tier.
      this.geometry.setAttribute("aBusy", this.busyAttribute);
      // Allocated up front, not on the first setColorAt. The shader only
      // declares vColor once the mesh has an instance color, and a mesh that
      // reaches its first frame without one compiles a program that fails on
      // the glow line.
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
    }
    this.parent.add(mesh);
    return mesh;
  }

  // Makes room for `count` instances, keeping nothing: the caller rewrites
  // every slot right after.
  reset(count: number) {
    if (count > this.mesh.instanceMatrix.count) {
      this.parent.remove(this.mesh);
      this.mesh.dispose();
      this.mesh = this.build(Math.max(MIN_CAPACITY, count * 2));
    }
    this.mesh.count = count;
  }

  place(index: number, matrix: THREE.Matrix4, color?: THREE.Color) {
    this.mesh.setMatrixAt(index, matrix);
    if (color) this.mesh.setColorAt(index, color);
  }

  setBusy(index: number, value: number) {
    if (this.glows) this.busyAttribute.setX(index, value);
  }

  uploadPlacements() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  uploadBusy() {
    if (this.glows) this.busyAttribute.needsUpdate = true;
  }

  dispose() {
    this.parent.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
  }
}

// `index` is the slot in the lot's own tier mesh; `shared` is the slot in the
// yard and beacon meshes, which run across all tiers.
type Slot = { tier: ModelTier; index: number; shared: number; activity: Activity };

export class InstancedLots {
  readonly group = new THREE.Group();

  private readonly hallMaterial = addBusyGlow(
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0, vertexColors: true }),
    literal(new THREE.Color(COLORS.windowLight)),
    0,
    HALL_BUSY_GLOW,
  );
  private readonly beaconMaterial = addBusyGlow(
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5, metalness: 0 }),
    "vColor.rgb",
    BEACON_IDLE,
    BEACON_BUSY,
  );
  private readonly yardMaterial = new THREE.MeshStandardMaterial({ color: COLORS.yard, roughness: 0.95 });
  private readonly rooflineMaterial = new THREE.MeshStandardMaterial({
    color: "#667078",
    roughness: 0.82,
    metalness: 0.08,
  });

  private readonly halls = new Map<ModelTier, Slab>();
  private readonly beacons: Slab;
  private readonly yards: Slab;
  private readonly rooflines: readonly [Slab, Slab];

  private slots = new Map<string, Slot>();
  private key = "";
  private readonly matrix = new THREE.Matrix4();

  constructor() {
    for (const tier of TIERS) {
      this.halls.set(tier, new Slab(hallGeometry(tier), this.hallMaterial, this.group, true));
    }
    this.beacons = new Slab(
      box(BEACON.size, BEACON.height, BEACON.size, 0, 0, 0),
      this.beaconMaterial,
      this.group,
      true,
    );
    this.rooflines = [
      new Slab(box(1, 1, 1, 0, 0, 0), this.rooflineMaterial, this.group, false),
      new Slab(box(1, 1, 1, 0, 0, 0), this.rooflineMaterial, this.group, false),
    ];
    this.yards = new Slab(
      box(YARD_HALF * 2, YARD_Y, YARD_HALF * 2, 0, YARD_Y / 2, 0),
      this.yardMaterial,
      this.group,
      false,
    );
  }

  // The full far set. Matrices and colors are only rewritten when the set (or
  // a lot's tier or place) actually changed; the busy values are taken every
  // time, because those change with every server message.
  sync(lots: readonly FarLot[], nowMs: number) {
    const key = lots.map((lot) => `${lot.id}:${lot.tier}:${lot.x}:${lot.z}`).join("|");
    if (key !== this.key) {
      this.key = key;
      this.relayout(lots);
    }
    for (const lot of lots) this.slots.get(lot.id)?.activity.set(lot.busy, nowMs);
  }

  // Eases every far lot's glow and uploads the whole busy buffer once.
  tick(dt: number, nowMs: number) {
    for (const slot of this.slots.values()) {
      const value = slot.activity.update(dt, nowMs);
      this.halls.get(slot.tier)?.setBusy(slot.index, value);
      this.beacons.setBusy(slot.shared, value);
    }
    for (const hall of this.halls.values()) hall.uploadBusy();
    this.beacons.uploadBusy();
  }

  dispose() {
    for (const hall of this.halls.values()) hall.dispose();
    this.beacons.dispose();
    for (const roofline of this.rooflines) roofline.dispose();
    this.yards.dispose();
    this.hallMaterial.dispose();
    this.beaconMaterial.dispose();
    this.rooflineMaterial.dispose();
    this.yardMaterial.dispose();
  }

  private relayout(lots: readonly FarLot[]) {
    const previous = this.slots;
    this.slots = new Map();

    const perTier = new Map<ModelTier, FarLot[]>(TIERS.map((tier) => [tier, []]));
    for (const lot of lots) perTier.get(lot.tier)?.push(lot);

    this.beacons.reset(lots.length);
    for (const roofline of this.rooflines) roofline.reset(lots.length);
    this.yards.reset(lots.length);

    let shared = 0;
    for (const tier of TIERS) {
      const group = perTier.get(tier)!;
      const slab = this.halls.get(tier)!;
      slab.reset(group.length);
      group.forEach((lot, index) => {
        slab.place(index, this.matrix.makeTranslation(lot.x, 0, lot.z), lot.wall);
        this.yards.place(shared, this.matrix.makeTranslation(lot.x, 0, lot.z));
        this.rooflines.forEach((roofline, massIndex) => {
          roofline.place(shared, rooflineMatrix(lot, massIndex, this.matrix));
        });
        this.beacons.place(shared, beaconMatrix(lot, this.matrix), lot.accent);
        // A lot that was already far keeps its eased glow, so swapping the set
        // never flashes a hall on or off.
        const activity = previous.get(lot.id)?.activity ?? new Activity();
        this.slots.set(lot.id, { tier, index, shared, activity });
        slab.setBusy(index, activity.value);
        this.beacons.setBusy(shared, activity.value);
        shared++;
      });
      slab.uploadPlacements();
    }
    this.beacons.uploadPlacements();
    for (const roofline of this.rooflines) roofline.uploadPlacements();
    this.yards.uploadPlacements();
  }
}
