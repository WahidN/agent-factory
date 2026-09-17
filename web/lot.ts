// One session's industrial lot: fenced yard, main hall, machines, traffic,
// workers, name sign, and its subagent warehouses. The hall and machines are
// sized by the session's model tier, and rebuilt in place when the tier changes.

import * as THREE from "three";
import type { SessionState } from "../server/types.ts";
import { Activity } from "./activity.ts";
import { destinationFor } from "./leisure.ts";
import { LightBox } from "./light-box.ts";
import { CoolingTower, createTruck, Forklift, Searchlight, Stacks, type StacksOptions, YARD_Y } from "./machines.ts";
import { type ModelTier, tierFor } from "./model-tier.ts";
import {
  accentFor,
  createWallMaterial,
  DECALS,
  MATERIALS,
  repeatUv,
  standard,
  WALL_BAY,
  WALL_TINTS,
} from "./palette.ts";
import { YARD_HALF } from "./park.ts";
import { movingCarCount, wallTintIndexFor } from "./park-layout.ts";
import { RoofSign } from "./roof-sign.ts";
import { Sign } from "./sign.ts";
import { StaticBuilder } from "./static-builder.ts";
import { addParkedCars } from "./traffic.ts";
import { easeOutBack, Warehouse } from "./warehouse.ts";
import { LotWorkers, type WorkerSlot } from "./workers.ts";
import type { Point } from "./worker-logic.ts";

// The hall keeps its dock side on every tier, so the dock door, hall door,
// parked cars and worker routes never move. A smaller hall shrinks toward the
// back left corner.
const HALL_X1 = 4;
const HALL_Z1 = -4;
const STRIPE = 1;
const DOCK_X = -7;
const GATE = { z0: 6, z1: 12 }; // opening in the right fence
const MAX_WAREHOUSES = 4;
const WAREHOUSE_SLOTS: [number, number][] = [
  [-8.5, 14],
  [-1.5, 14],
  [5.5, 14],
  [12.5, 14],
];
const SINK_DEPTH = 12;

// Hall footprint and machine sizes per tier. Machines stay clear of the parked
// cars, the worker routes, and the fence on every tier (see design.md).
type LotSize = {
  hall: { x0: number; z0: number };
  bays: number; // rows of windows
  stacks: StacksOptions & { at: [number, number] };
  cooling: { at: [number, number]; radius: number; height: number };
  searchlight: { height: number; reach: number };
};

const SIZES: Record<ModelTier, LotSize> = {
  small: {
    hall: { x0: -10, z0: -12 },
    bays: 1,
    stacks: { at: [12, -12], count: 1, height: 7, radius: 0.7, frame: false },
    cooling: { at: [12.5, 0.5], radius: 2.4, height: 5 },
    searchlight: { height: 5, reach: 9 },
  },
  medium: {
    hall: { x0: -18, z0: -18 },
    bays: 1,
    stacks: { at: [12, -12], count: 3, height: 11, radius: 0.9, frame: true },
    cooling: { at: [12.5, 0.5], radius: 3.6, height: 8 },
    searchlight: { height: 9, reach: 11 },
  },
  large: {
    hall: { x0: -18, z0: -18 },
    bays: 2,
    stacks: { at: [12, -12], count: 4, height: 14, radius: 0.95, frame: true },
    cooling: { at: [12.5, 0.5], radius: 4.2, height: 11 },
    searchlight: { height: 12, reach: 12 },
  },
  huge: {
    hall: { x0: -18, z0: -18 },
    bays: 3,
    stacks: { at: [12, -13], count: 5, height: 17, radius: 0.85, frame: true },
    cooling: { at: [13.5, 1], radius: 4.8, height: 14 },
    searchlight: { height: 14, reach: 13 },
  },
};

function hallTop(size: LotSize) {
  return YARD_Y + STRIPE + size.bays * WALL_BAY.height;
}

// The hall's outer box per tier. The far level in instanced-lots.ts builds the
// same volume from one merged geometry, so a lot does not jump size or move
// when it swaps between the two levels.
export type HallShape = { x0: number; z0: number; x1: number; z1: number; top: number };

export function hallShape(tier: ModelTier): HallShape {
  const size = SIZES[tier];
  return { x0: size.hall.x0, z0: size.hall.z0, x1: HALL_X1, z1: HALL_Z1, top: hallTop(size) };
}

// Worker routes avoid buildings and machines (see design.md). The first 4 work
// the main yard; the rest stand in front of the warehouse slots.
type BaseSlot = { door: Point; route: [Point, Point] };
const HALL_DOOR = { x: 1.5, z: -3.3 };
const WORKER_SLOTS: BaseSlot[] = [
  {
    door: HALL_DOOR,
    route: [
      { x: 1.5, z: -3.3 },
      { x: 2.3, z: 9.3 },
    ],
  }, // past the hatch, between parked cars
  {
    door: HALL_DOOR,
    route: [
      { x: -2.5, z: -3.3 },
      { x: -2.5, z: 3.5 },
    ],
  }, // beside the forklift lane
  {
    door: HALL_DOOR,
    route: [
      { x: 6, z: -3.4 },
      { x: 17.5, z: -5.8 },
    ],
  }, // between stacks and cooling tower
  {
    door: HALL_DOOR,
    route: [
      { x: 5, z: 9.5 },
      { x: 18.5, z: 9.5 },
    ],
  }, // along the walkway to the gate
  ...WAREHOUSE_SLOTS.map(
    ([x, z]): BaseSlot => ({
      door: { x: x + 1.2, z: z + 2.9 },
      route: [
        { x: x - 1.8, z: z + 3.6 },
        { x: x + 1.8, z: z + 3.6 },
      ],
    }),
  ),
];

// The gate's local point: the opening in the right fence, GATE.z0..z1 at x = YARD_HALF.
const GATE_POINT: Point = { x: YARD_HALF, z: (GATE.z0 + GATE.z1) / 2 };

const SPREAD_STRIDE = 3; // spacing between neighbouring workers along the edge

// A quiet lot's workers gather near the nearest claimed cell instead of one
// another, spread along the cell edge their destination sits on so eight of
// them are not standing on top of each other.
function spread(point: Point, axis: "x" | "z", index: number, count: number): Point {
  const offset = (index - (count - 1) / 2) * SPREAD_STRIDE;
  return axis === "x" ? { x: point.x + offset, z: point.z } : { x: point.x, z: point.z + offset };
}

function workerSlotsFor(rank: number, rankCount: number): WorkerSlot[] {
  const destination = destinationFor(rank, rankCount);
  return WORKER_SLOTS.map((slot, i) => ({
    ...slot,
    gate: GATE_POINT,
    destination: destination ? spread(destination.point, destination.axis, i, WORKER_SLOTS.length) : null,
  }));
}

// Rooftop vents and AC boxes, relative to the hall's back left corner. Ones
// that fall outside a smaller roof are left out.
const VENTS: [number, number][] = [
  [2, 2.5],
  [5, 11.5],
  [8.5, 2],
  [12, 12],
  [15.5, 3],
  [19, 11],
  [20, 6.5],
  [3.5, 7],
];
const SKYLIGHTS: [number, number][] = [
  [9, 4.5],
  [9, 9.5],
];
const AC_BOXES: [number, number][] = [
  [17, 4.5],
  [17.5, 9.5],
];

type Slot = { warehouse: Warehouse; slot: number };
type Machines = { stacks: Stacks; forklift: Forklift; searchlight: Searchlight; cooling: CoolingTower };

export class Lot {
  readonly group = new THREE.Group();
  state: SessionState;
  tier: ModelTier;
  gone = false;

  private body = new THREE.Group();
  // Everything sized by the tier: yard markings, hall, machines, parked cars, sign.
  private structure = new THREE.Group();
  private machines!: Machines;
  private sign!: Sign;
  private lightBox!: LightBox;
  private roofSign!: RoofSign;
  private builtModel!: string;
  private hallPickables: THREE.Mesh[] = [];
  private busy = new Activity();

  private accent: THREE.Color;
  private accentGrey: THREE.Color;
  private accentMaterial: THREE.MeshStandardMaterial;
  // Fixed at construction from the user who opened the session. A user
  // switch mid-session (an id gets re-prefixed) does not retint the wall; the
  // tint only changes with a fresh Lot.
  private wallMaterial: THREE.MeshStandardMaterial;

  private workers: LotWorkers;
  // Where this lot's leisure destination was last computed for; kept so a
  // repeat call with the same rank/rankCount (the common case: most lots
  // don't move when one session starts or stops) recomputes nothing.
  private rank: number;
  private rankCount: number;

  private warehouses = new Map<number, Slot>();
  private leavingWarehouses = new Set<Slot>();
  private overflow = 0;

  private appear = 0;
  private exit: { t: number; onGone: () => void } | null = null;

  // `settled` skips the rise out of the ground: a lot that only swapped from
  // the far level to this one was already standing, so it must not replay its
  // arrival every time the camera drifts past it.
  //
  // `rank` and `rankCount` fix where this lot's workers hang around while it
  // is quiet: the nearest claimed cell to `rank`'s own cell, among the
  // `rankCount` cells the city plan has claimed so far. The park repacks
  // ranks whenever a session starts or stops, so `setPlot` keeps this current
  // without rebuilding the lot; it is not recomputed per frame.
  constructor(state: SessionState, rank: number, rankCount: number, settled = false) {
    this.state = state;
    this.appear = settled ? 1 : 0;
    this.tier = tierFor(state.model);
    this.accent = accentFor(state.project);
    const l = this.accent.r * 0.3 + this.accent.g * 0.59 + this.accent.b * 0.11;
    this.accentGrey = new THREE.Color(l, l, l);
    this.accentMaterial = standard(this.accent.clone());
    this.accentMaterial.userData.separate = true; // its color animates
    this.wallMaterial = createWallMaterial(WALL_TINTS[wallTintIndexFor(state.user)]);
    this.rank = rank;
    this.rankCount = rankCount;
    this.workers = new LotWorkers(workerSlotsFor(rank, rankCount));

    this.buildStructure();

    // The parked truck is the same on every tier. It shares the truck
    // template's geometry, so it stays out of the rebuilt structure.
    const parked = createTruck();
    parked.position.set(-9, YARD_Y, 5.8);
    parked.traverse((child) => (child.castShadow = child.receiveShadow = true));

    this.body.add(parked, this.workers.mesh);
    this.body.position.y = settled ? 0 : -SINK_DEPTH;
    this.group.add(this.body);
    this.update(state, performance.now());
  }

  update(state: SessionState, nowMs: number) {
    this.state = state;
    const tier = tierFor(state.model);
    // The roof letters show the model name, so a same-tier model swap
    // ("claude-opus-5" to "claude-opus-4-5") also needs a rebuild.
    if (tier !== this.tier || state.model !== this.builtModel) {
      this.tier = tier;
      this.disposeStructure();
      this.buildStructure();
    }
    this.syncSign();
    this.lightBox.update(this.state.project);
    const working = state.status === "busy";
    this.busy.set(working, nowMs);
    this.updateWarehouses(state.subagents, working, nowMs);
  }

  // Called whenever the park repacks and this lot's rank or the total rank
  // count changed, so its leisure destination stays pointed at the right
  // claimed cell. Only the destination points move; a worker already walking
  // there keeps its position and simply steers toward the new point next
  // tick, no rebuild and no jump.
  setPlot(rank: number, rankCount: number) {
    if (rank === this.rank && rankCount === this.rankCount) return;
    this.rank = rank;
    this.rankCount = rankCount;
    this.workers.setSlots(workerSlotsFor(rank, rankCount));
  }

  // What this lot sends onto the park roads: always some cars, the truck only while busy.
  traffic(): { cars: number; truck: boolean } {
    const lotBusy = this.state.status === "busy" && !this.exit;
    return { cars: movingCarCount(lotBusy, this.state.subagents), truck: lotBusy };
  }

  pickables(): THREE.Mesh[] {
    return [
      ...this.hallPickables,
      ...this.sign.pickables,
      ...this.lightBox.pickables,
      ...[...this.warehouses.values()].flatMap((s) => s.warehouse.pickables),
    ];
  }

  remove(onGone: () => void) {
    if (this.exit) return;
    this.busy.set(false, 0);
    for (const [slot, entry] of this.warehouses) this.leaveWarehouse(slot, entry);
    this.exit = { t: 0, onGone };
  }

  tick(dt: number, nowMs: number) {
    if (this.gone) return;
    const busy = this.busy.update(dt, nowMs);

    this.wallMaterial.emissiveIntensity = busy * 1.1;
    this.lightBox.setGlow(busy);
    this.accentMaterial.color.copy(this.accent).lerp(this.accentGrey, (1 - busy) * 0.35);

    this.machines.stacks.tick(dt, busy, busy);
    this.machines.forklift.tick(dt, busy);
    this.machines.searchlight.tick(dt, busy);
    this.machines.cooling.tick(dt, busy, busy);
    this.workers.tick(dt, this.workerBusyFlags());

    for (const slot of [...this.warehouses.values(), ...this.leavingWarehouses]) slot.warehouse.tick(dt, nowMs);
    this.tickLifecycle(dt);
  }

  dispose() {
    this.disposeStructure();
    this.wallMaterial.dispose();
    this.accentMaterial.dispose();
    this.workers.mesh.dispose();
    for (const slot of [...this.warehouses.values(), ...this.leavingWarehouses]) slot.warehouse.dispose();
  }

  // ---------- Building ----------

  private buildStructure() {
    const size = SIZES[this.tier];
    this.builtModel = this.state.model;
    const builder = new StaticBuilder();
    this.buildYard(builder);
    this.buildHall(builder, size);

    const { at: stacksAt, ...stacksOptions } = size.stacks;
    const stacks = new Stacks(builder, stacksAt, stacksOptions);
    const forklift = new Forklift(builder, DOCK_X, -2.2, 2.6);
    const searchlight = new Searchlight(builder, [-17, 12], { tower: true, ...size.searchlight, aimAt: [-4, 2] });
    const cooling = new CoolingTower(builder, size.cooling.at, size.cooling.radius, size.cooling.height);
    addParkedCars(builder, this.state.id);

    const statics = builder.build();
    const hallMaterials: THREE.Material[] = [this.wallMaterial, MATERIALS.roof, this.accentMaterial];
    this.hallPickables = (statics.children as THREE.Mesh[]).filter((mesh) =>
      hallMaterials.includes(mesh.material as THREE.Material),
    );
    for (const mesh of this.hallPickables) mesh.userData.hover = this;

    this.machines = { stacks, forklift, searchlight, cooling };
    this.structure = new THREE.Group();
    this.structure.add(statics, stacks.group, forklift.group, searchlight.group, cooling.group);

    // Yard sign, standing along the front fence facing +z. It spans x 3 to 19
    // on z 18.8 (depth 0.12): the wall sits at z 20 (0.3 thick, inner face
    // 19.85), the warehouse slots sit at z 14 with depth 5 (to z 16.5) and
    // their work routes at z 17.6, so nothing overlaps.
    this.sign = new Sign(this.accent);
    this.sign.group.position.set(11, YARD_Y, 18.8);
    this.sign.group.rotation.y = 0;
    for (const mesh of this.sign.pickables) mesh.userData.hover = this;
    this.structure.add(this.sign.group);

    // Light box on the front facade. Clamped above the stripe so a 1 bay hall
    // (wall height 6) never sinks the box into the yard markings.
    // Anchored to HALL_X1 - 2.5 (x 1.5, half width 1.5, so x 0..3) instead of
    // hall.x0: on the small tier the dock side (hall.x0 = -10) is too tight.
    // Checked on all four tiers: dock door (x -8.8..-5.2) and awning
    // (x -9.3..-4.7) sit at least 4.7 clear of x 0..3. The people door
    // (x 0.9..2.1, y 0.3..2.5) overlaps in x and z but the box's y starts at
    // 3.5 on the smallest hall (small/medium: y 3.5..6.5, large: 9.5..12.5,
    // huge: 15.5..18.5), well above the door top. x 0..3 also stays inside
    // the facade width [hall.x0, HALL_X1] on every tier.
    this.lightBox = new LightBox(this.accent, 3);
    const boxY = Math.max(hallTop(size) - 2.2, YARD_Y + STRIPE + 1.8);
    this.lightBox.group.position.set(HALL_X1 - 2.5, boxY, HALL_Z1 + 0.2);
    this.lightBox.group.rotation.y = 0;
    for (const mesh of this.lightBox.pickables) mesh.userData.hover = this;
    this.structure.add(this.lightBox.group);

    // Roof letters at the front edge, in the band between the parapet (which
    // reaches back to HALL_Z1 - 0.4) and the front row of vents (whose faces
    // sit at HALL_Z1 - 1.52). The letters are 0.5 deep, so only this narrow
    // gap keeps them clear of both.
    this.roofSign = new RoofSign(this.state.model, HALL_X1 - size.hall.x0);
    this.roofSign.group.position.set((size.hall.x0 + HALL_X1) / 2, hallTop(size) + 0.3, HALL_Z1 - 1);
    this.roofSign.group.rotation.y = 0;
    this.structure.add(this.roofSign.group);

    this.body.add(this.structure);
    this.syncSign();
    this.lightBox.update(this.state.project);
  }

  private disposeStructure() {
    this.body.remove(this.structure);
    this.machines.stacks.dispose();
    this.machines.searchlight.dispose();
    this.machines.cooling.dispose();
    this.sign.dispose();
    this.lightBox.dispose();
    this.roofSign.dispose();
    // Own merged geometry only; smoke and steam are instanced and share one puff geometry.
    // The sign's own geometries (posts, board, stripe, text planes) are disposed
    // above by Sign.dispose(); this traversal disposes them a second time, which
    // is harmless in Three.js since geometry.dispose() is idempotent.
    this.structure.traverse((child) => {
      if (child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh)) child.geometry.dispose();
    });
  }

  private buildYard(b: StaticBuilder) {
    const h = YARD_HALF;
    b.box(MATERIALS.yard, [0, YARD_Y / 2, 0], [h * 2, YARD_Y, h * 2]);

    // Low concrete wall with posts, open at the gate on the right side.
    const wallHeight = 1.1;
    const segment = (x0: number, z0: number, x1: number, z1: number) => {
      const length = Math.hypot(x1 - x0, z1 - z0);
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      b.box(
        MATERIALS.concrete,
        [(x0 + x1) / 2, YARD_Y + wallHeight / 2, (z0 + z1) / 2],
        alongX ? [length, wallHeight, 0.3] : [0.3, wallHeight, length],
      );
    };
    segment(-h, -h, h, -h);
    segment(-h, h, h, h);
    segment(-h, -h, -h, h);
    segment(h, -h, h, GATE.z0);
    segment(h, GATE.z1, h, h);
    for (let t = -h; t <= h; t += 5) {
      for (const [x, z] of [
        [t, -h],
        [t, h],
        [-h, t],
        [h, t],
      ]) {
        if (x === h && z > GATE.z0 && z < GATE.z1) continue;
        b.box(MATERIALS.parapet, [x, YARD_Y + 0.7, z], [0.5, 1.4, 0.5]);
      }
    }
    // Yellow gate barrier posts
    for (const z of [GATE.z0, GATE.z1]) b.cylinder(MATERIALS.yellow, [h, YARD_Y + 0.7, z], [0.25, 1.4, 0.25]);

    // Markings: truck bay lines, dashed walkway, hatch by the dock.
    const flat = (material: THREE.Material, x: number, z: number, w: number, d: number) =>
      b.add(new THREE.PlaneGeometry(w, d), material, [x, YARD_Y + 0.01, z], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    flat(DECALS.yellowLine, -9, 4.1, 15, 0.18);
    flat(DECALS.yellowLine, -9, 7.6, 15, 0.18);
    for (let x = 6; x < 19; x += 2.2) flat(DECALS.white, x, 9, 1.2, 0.25);
    flat(DECALS.hatch, 0.5, -1.8, 4, 3);
  }

  private buildHall(b: StaticBuilder, size: LotSize) {
    const { x0, z0 } = size.hall;
    const x1 = HALL_X1;
    const z1 = HALL_Z1;
    const wall = size.bays * WALL_BAY.height;
    const top = hallTop(size);
    const width = x1 - x0;
    const depth = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const wallY = YARD_Y + STRIPE + wall / 2;

    b.box(this.accentMaterial, [cx, YARD_Y + STRIPE / 2, cz], [width + 0.1, STRIPE, depth + 0.1]);
    const wallPlane = (length: number) =>
      repeatUv(new THREE.PlaneGeometry(length, wall), length / WALL_BAY.width, size.bays);
    b.add(wallPlane(width), this.wallMaterial, [cx, wallY, z1]);
    b.add(wallPlane(width), this.wallMaterial, [cx, wallY, z0], [1, 1, 1], [0, Math.PI, 0]);
    b.add(wallPlane(depth), this.wallMaterial, [x1, wallY, cz], [1, 1, 1], [0, Math.PI / 2, 0]);
    b.add(wallPlane(depth), this.wallMaterial, [x0, wallY, cz], [1, 1, 1], [0, -Math.PI / 2, 0]);

    // Flat roof with parapet
    b.box(MATERIALS.roof, [cx, top + 0.15, cz], [width, 0.3, depth]);
    for (const s of [-1, 1]) {
      b.box(MATERIALS.parapet, [cx, top + 0.4, cz + s * (depth / 2 - 0.2)], [width + 0.1, 0.8, 0.4]);
      b.box(MATERIALS.parapet, [cx + s * (width / 2 - 0.2), top + 0.4, cz], [0.4, 0.8, depth + 0.1]);
    }

    // Rooftop: vents, skylights, AC boxes. `fits` keeps a piece of the given
    // half size inside the parapet.
    const fits = ([vx, vz]: [number, number], halfX: number, halfZ: number) =>
      vx + halfX < width - 0.5 && vz + halfZ < depth - 0.5;
    for (const vent of VENTS.filter((v) => fits(v, 0.5, 0.5))) {
      const x = x0 + vent[0];
      const z = z0 + vent[1];
      b.cylinder(MATERIALS.frame, [x, top + 0.6, z], [0.35, 0.6, 0.35]);
      b.cylinder(MATERIALS.white, [x, top + 1.0, z], [0.48, 0.18, 0.48]);
    }
    const skylight = new THREE.CylinderGeometry(0.9, 0.9, 7, 14, 1, false, 0, Math.PI);
    for (const [vx, vz] of SKYLIGHTS.filter((v) => fits(v, 3.5, 0.9))) {
      b.add(skylight, MATERIALS.frame, [x0 + vx, top + 0.3, z0 + vz], [1, 1, 1], [0, 0, Math.PI / 2]);
    }
    for (const [vx, vz] of AC_BOXES.filter((v) => fits(v, 0.9, 0.65))) {
      b.box(MATERIALS.frame, [x0 + vx, top + 0.75, z0 + vz], [1.8, 0.9, 1.3]);
      b.cylinder(MATERIALS.darkSteel, [x0 + vx, top + 1.22, z0 + vz], [0.45, 0.05, 0.45]);
    }

    // Loading dock door with awning, and a people door
    b.box(this.accentMaterial, [DOCK_X, YARD_Y + 2.2, z1 + 0.06], [3.6, 4.2, 0.12]);
    b.box(MATERIALS.darkSteel, [DOCK_X, YARD_Y + 4.75, z1 + 0.8], [4.6, 0.18, 1.6]);
    b.box(MATERIALS.darkSteel, [1.5, YARD_Y + 1.2, z1 + 0.05], [1.2, 2.2, 0.1]);
    for (const s of [-1, 1]) b.cylinder(MATERIALS.yellow, [DOCK_X + s * 2.3, YARD_Y + 0.5, z1 + 0.5], [0.15, 1, 0.15]);
  }

  // ---------- Warehouses ----------

  // No per-subagent identity survives on the wire, just a count: this fills
  // slots 0..count-1 and empties the rest, all mirroring the lot's own busy
  // state (there is no separate busy flag per subagent anymore).
  private updateWarehouses(count: number, busy: boolean, nowMs: number) {
    const target = Math.min(count, MAX_WAREHOUSES);
    for (const [slot, entry] of [...this.warehouses]) if (slot >= target) this.leaveWarehouse(slot, entry);

    for (let slot = 0; slot < target; slot++) {
      if (this.warehouses.has(slot) || this.slotLeaving(slot) || this.exit) continue;
      const warehouse = new Warehouse(this.accent);
      const [x, z] = WAREHOUSE_SLOTS[slot];
      warehouse.group.position.set(x, 0, z);
      for (const mesh of warehouse.pickables) mesh.userData.hover = this;
      this.body.add(warehouse.group);
      this.warehouses.set(slot, { warehouse, slot });
    }

    for (const { warehouse } of this.warehouses.values()) warehouse.update(busy, nowMs);

    const waiting = Math.max(0, count - MAX_WAREHOUSES);
    if (waiting !== this.overflow) {
      this.overflow = waiting;
      this.syncSign();
    }
  }

  // A leaving warehouse keeps its slot until it has shrunk away.
  private leaveWarehouse(slot: number, entry: Slot) {
    this.warehouses.delete(slot);
    this.leavingWarehouses.add(entry);
    entry.warehouse.remove(() => {
      this.leavingWarehouses.delete(entry);
      this.body.remove(entry.warehouse.group);
      entry.warehouse.dispose();
    });
  }

  private slotLeaving(slot: number): boolean {
    for (const entry of this.leavingWarehouses) if (entry.slot === slot) return true;
    return false;
  }

  // Yard workers follow the session; each warehouse worker follows the same busy state.
  private workerBusyFlags(): boolean[] {
    const lotBusy = this.state.status === "busy" && !this.exit;
    const slotBusy = new Array(MAX_WAREHOUSES).fill(false);
    for (const slot of this.warehouses.keys()) slotBusy[slot] = lotBusy;
    return [lotBusy, lotBusy, lotBusy, lotBusy, ...slotBusy];
  }

  // ---------- Lifecycle ----------

  // Rises out of the ground on arrival, sinks back when the session ends.
  private tickLifecycle(dt: number) {
    if (!this.exit) {
      this.appear = Math.min(1, this.appear + dt / 0.8);
      this.body.position.y = -SINK_DEPTH * (1 - easeOutBack(this.appear));
      return;
    }
    this.exit.t += dt;
    const k = Math.min(1, this.exit.t);
    this.body.position.y = -SINK_DEPTH * k * k;
    if (k >= 1) {
      this.gone = true;
      this.exit.onGone();
    }
  }

  // ---------- Sign ----------

  private syncSign() {
    this.sign.update({ user: this.state.user, overflow: this.overflow });
  }
}
