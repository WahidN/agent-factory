// One session's industrial lot: fenced yard, main hall, machines, traffic,
// workers, name sign, and its subagent warehouses.

import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { AgentState, SessionState } from "../server/types.ts";
import { Activity } from "./activity.ts";
import { CoolingTower, createTruck, Forklift, Searchlight, Stacks, YARD_Y } from "./machines.ts";
import { accentFor, createWallMaterial, DECALS, MATERIALS, repeatUv, standard, WALL_BAY } from "./palette.ts";
import { ROAD_WIDTH, YARD_HALF } from "./park.ts";
import { PLOT_SIZE } from "./plots.ts";
import { StaticBuilder } from "./static-builder.ts";
import { addParkedCars, LotTraffic } from "./traffic.ts";
import { easeOutBack, Warehouse } from "./warehouse.ts";
import { LotWorkers, type WorkerSlot } from "./workers.ts";

type Part = "forklift" | "stacks" | "searchlight" | "cooling";

const TOOL_PARTS: Record<string, Part> = {
  Edit: "forklift",
  Write: "forklift",
  NotebookEdit: "forklift",
  Bash: "stacks",
  Read: "searchlight",
  Grep: "searchlight",
  Glob: "searchlight",
};

function partForTool(name: string): Part {
  return TOOL_PARTS[name] ?? "cooling";
}

const HALL = { x0: -18, x1: 4, z0: -18, z1: -4, stripe: 1, wall: WALL_BAY.height };
const HALL_TOP = YARD_Y + HALL.stripe + HALL.wall;
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
const TRUCK_LANE = PLOT_SIZE / 2 - ROAD_WIDTH / 4; // inner lane of the surrounding roads

// Worker routes avoid buildings and machines (see design.md). The first 4 work
// the main yard; the rest stand in front of the warehouse slots.
const HALL_DOOR = { x: 1.5, z: -3.3 };
const WORKER_SLOTS: WorkerSlot[] = [
  { door: HALL_DOOR, route: [{ x: 1.5, z: -3.3 }, { x: 2.3, z: 9.3 }] }, // past the hatch, between parked cars
  { door: HALL_DOOR, route: [{ x: -2.5, z: -3.3 }, { x: -2.5, z: 3.5 }] }, // beside the forklift lane
  { door: HALL_DOOR, route: [{ x: 6, z: -3.4 }, { x: 17.5, z: -5.8 }] }, // between stacks and cooling tower
  { door: HALL_DOOR, route: [{ x: 5, z: 9.5 }, { x: 18.5, z: 9.5 }] }, // along the walkway to the gate
  ...WAREHOUSE_SLOTS.map(([x, z]): WorkerSlot => ({
    door: { x: x + 1.2, z: z + 2.9 },
    route: [{ x: x - 1.8, z: z + 3.6 }, { x: x + 1.8, z: z + 3.6 }],
  })),
];

// Rooftop vents and AC boxes, relative to the hall's corner.
const VENTS: [number, number][] = [
  [2, 2.5], [5, 11.5], [8.5, 2], [12, 12], [15.5, 3], [19, 11], [20, 6.5], [3.5, 7],
];

type Slot = { warehouse: Warehouse; slot: number };

export class Lot {
  readonly group = new THREE.Group();
  state: SessionState;
  gone = false;

  private body = new THREE.Group();
  private hallPickables: THREE.Mesh[] = [];
  private busy = new Activity();
  private parts: Record<Part, Activity> = {
    forklift: new Activity(),
    stacks: new Activity(),
    searchlight: new Activity(),
    cooling: new Activity(),
  };

  private accent: THREE.Color;
  private accentGrey: THREE.Color;
  private accentMaterial: THREE.MeshStandardMaterial;
  private wallMaterial = createWallMaterial();

  private stacks: Stacks;
  private forklift: Forklift;
  private searchlight: Searchlight;
  private cooling: CoolingTower;
  private traffic: LotTraffic;
  private workers = new LotWorkers(WORKER_SLOTS);
  private busySubagents = 0;

  private warehouses = new Map<string, Slot>();
  private leavingWarehouses = new Set<Slot>();
  private overflow = 0;
  private sign: { element: HTMLElement; name: HTMLElement; badge: HTMLElement };

  private appear = 0;
  private exit: { t: number; onGone: () => void } | null = null;

  constructor(state: SessionState) {
    this.state = state;
    this.accent = accentFor(state.cwd);
    const l = this.accent.r * 0.3 + this.accent.g * 0.59 + this.accent.b * 0.11;
    this.accentGrey = new THREE.Color(l, l, l);
    this.accentMaterial = standard(this.accent.clone());
    this.accentMaterial.userData.separate = true; // its color animates

    const builder = new StaticBuilder();
    this.buildYard(builder);
    this.buildHall(builder);

    this.stacks = new Stacks(builder, [12, -12], { count: 3, height: 11, radius: 0.9, frame: true });
    this.forklift = new Forklift(builder, DOCK_X, -2.2, 2.6);
    this.searchlight = new Searchlight(builder, [-17, 12], { tower: true, height: 9, reach: 11, aimAt: [-4, 2] });
    this.cooling = new CoolingTower(builder, [12.5, 0.5], 3.6, 8);
    addParkedCars(builder, state.id);
    this.traffic = new LotTraffic(TRUCK_LANE, state.id);

    const parked = createTruck();
    parked.position.set(-9, YARD_Y, 5.8);
    parked.traverse((child) => (child.castShadow = child.receiveShadow = true));

    const statics = builder.build();
    const hallMaterials: THREE.Material[] = [this.wallMaterial, MATERIALS.roof, this.accentMaterial];
    for (const mesh of statics.children as THREE.Mesh[]) {
      if (hallMaterials.includes(mesh.material as THREE.Material)) {
        mesh.userData.hover = this;
        this.hallPickables.push(mesh);
      }
    }

    this.sign = this.createSign();
    this.drawSign();
    this.body.add(statics, parked, this.stacks.group, this.forklift.group, this.searchlight.group, this.cooling.group, this.traffic.group, this.workers.mesh);
    this.body.position.y = -SINK_DEPTH;
    this.group.add(this.body);
    this.update(state, performance.now());
  }

  update(state: SessionState, nowMs: number) {
    const nameChanged = state.name !== this.state.name;
    this.state = state;
    const working = state.status === "busy";
    this.busy.set(working, nowMs);
    const active = working && state.currentTool ? partForTool(state.currentTool.name) : null;
    for (const part of Object.keys(this.parts) as Part[]) this.parts[part].set(part === active, nowMs);
    this.busySubagents = state.subagents.filter((s) => s.status === "busy").length;
    this.updateWarehouses(state.subagents, nowMs);
    if (nameChanged) this.drawSign();
  }

  pickables(): THREE.Mesh[] {
    return [...this.hallPickables, ...[...this.warehouses.values()].flatMap((s) => s.warehouse.pickables)];
  }

  remove(onGone: () => void) {
    if (this.exit) return;
    this.busy.set(false, 0);
    for (const part of Object.values(this.parts)) part.set(false, 0);
    for (const [id, slot] of this.warehouses) this.leaveWarehouse(id, slot);
    this.exit = { t: 0, onGone };
  }

  tick(dt: number, nowMs: number) {
    if (this.gone) return;
    const busy = this.busy.update(dt, nowMs);
    const forklift = this.parts.forklift.update(dt, nowMs);
    const stacks = this.parts.stacks.update(dt, nowMs);
    const searchlight = this.parts.searchlight.update(dt, nowMs);
    const cooling = this.parts.cooling.update(dt, nowMs);

    this.wallMaterial.emissiveIntensity = busy * 1.1;
    this.accentMaterial.color.copy(this.accent).lerp(this.accentGrey, (1 - busy) * 0.35);

    this.stacks.tick(dt, busy, stacks);
    this.forklift.tick(dt, forklift);
    this.searchlight.tick(dt, searchlight);
    this.cooling.tick(dt, cooling);
    this.traffic.tick(dt, busy, this.state.status === "busy" && !this.exit, this.busySubagents);
    this.workers.tick(dt, this.workerBusyFlags());

    for (const slot of [...this.warehouses.values(), ...this.leavingWarehouses]) slot.warehouse.tick(dt, nowMs);
    this.tickLifecycle(dt);
  }

  dispose() {
    this.wallMaterial.dispose();
    this.accentMaterial.dispose();
    this.stacks.dispose();
    this.searchlight.dispose();
    this.cooling.dispose();
    this.traffic.dispose();
    this.workers.mesh.dispose();
    // Three.js only tells the removed object itself, not the label inside it,
    // so the label's HTML element has to be removed by hand.
    this.sign.element.remove();
    for (const slot of [...this.warehouses.values(), ...this.leavingWarehouses]) slot.warehouse.dispose();
  }

  // ---------- Building ----------

  private buildYard(b: StaticBuilder) {
    const h = YARD_HALF;
    b.box(MATERIALS.yard, [0, YARD_Y / 2, 0], [h * 2, YARD_Y, h * 2]);

    // Low concrete wall with posts, open at the gate on the right side.
    const wallHeight = 1.1;
    const segment = (x0: number, z0: number, x1: number, z1: number) => {
      const length = Math.hypot(x1 - x0, z1 - z0);
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      b.box(MATERIALS.concrete, [(x0 + x1) / 2, YARD_Y + wallHeight / 2, (z0 + z1) / 2], alongX ? [length, wallHeight, 0.3] : [0.3, wallHeight, length]);
    };
    segment(-h, -h, h, -h);
    segment(-h, h, h, h);
    segment(-h, -h, -h, h);
    segment(h, -h, h, GATE.z0);
    segment(h, GATE.z1, h, h);
    for (let t = -h; t <= h; t += 5) {
      for (const [x, z] of [[t, -h], [t, h], [-h, t], [h, t]]) {
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

  private buildHall(b: StaticBuilder) {
    const { x0, x1, z0, z1, stripe, wall } = HALL;
    const width = x1 - x0;
    const depth = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const wallY = YARD_Y + stripe + wall / 2;

    b.box(this.accentMaterial, [cx, YARD_Y + stripe / 2, cz], [width + 0.1, stripe, depth + 0.1]);
    const wallPlane = (length: number) => repeatUv(new THREE.PlaneGeometry(length, wall), length / WALL_BAY.width, 1);
    b.add(wallPlane(width), this.wallMaterial, [cx, wallY, z1]);
    b.add(wallPlane(width), this.wallMaterial, [cx, wallY, z0], [1, 1, 1], [0, Math.PI, 0]);
    b.add(wallPlane(depth), this.wallMaterial, [x1, wallY, cz], [1, 1, 1], [0, Math.PI / 2, 0]);
    b.add(wallPlane(depth), this.wallMaterial, [x0, wallY, cz], [1, 1, 1], [0, -Math.PI / 2, 0]);

    // Flat roof with parapet
    b.box(MATERIALS.roof, [cx, HALL_TOP + 0.15, cz], [width, 0.3, depth]);
    for (const s of [-1, 1]) {
      b.box(MATERIALS.parapet, [cx, HALL_TOP + 0.4, cz + s * (depth / 2 - 0.2)], [width + 0.1, 0.8, 0.4]);
      b.box(MATERIALS.parapet, [cx + s * (width / 2 - 0.2), HALL_TOP + 0.4, cz], [0.4, 0.8, depth + 0.1]);
    }

    // Rooftop: vents, skylights, AC boxes
    for (const [vx, vz] of VENTS) {
      const x = x0 + vx;
      const z = z0 + vz;
      b.cylinder(MATERIALS.frame, [x, HALL_TOP + 0.6, z], [0.35, 0.6, 0.35]);
      b.cylinder(MATERIALS.white, [x, HALL_TOP + 1.0, z], [0.48, 0.18, 0.48]);
    }
    const skylight = new THREE.CylinderGeometry(0.9, 0.9, 7, 14, 1, false, 0, Math.PI);
    for (const vz of [4.5, 9.5]) b.add(skylight, MATERIALS.frame, [x0 + 9, HALL_TOP + 0.3, z0 + vz], [1, 1, 1], [0, 0, Math.PI / 2]);
    for (const [vx, vz] of [[17, 4.5], [17.5, 9.5]]) {
      b.box(MATERIALS.frame, [x0 + vx, HALL_TOP + 0.75, z0 + vz], [1.8, 0.9, 1.3]);
      b.cylinder(MATERIALS.darkSteel, [x0 + vx, HALL_TOP + 1.22, z0 + vz], [0.45, 0.05, 0.45]);
    }

    // Loading dock door with awning, and a people door
    b.box(this.accentMaterial, [DOCK_X, YARD_Y + 2.2, z1 + 0.06], [3.6, 4.2, 0.12]);
    b.box(MATERIALS.darkSteel, [DOCK_X, YARD_Y + 4.75, z1 + 0.8], [4.6, 0.18, 1.6]);
    b.box(MATERIALS.darkSteel, [1.5, YARD_Y + 1.2, z1 + 0.05], [1.2, 2.2, 0.1]);
    for (const s of [-1, 1]) b.cylinder(MATERIALS.yellow, [DOCK_X + s * 2.3, YARD_Y + 0.5, z1 + 0.5], [0.15, 1, 0.15]);
  }

  // ---------- Warehouses ----------

  private updateWarehouses(subagents: AgentState[], nowMs: number) {
    const ids = new Set(subagents.map((s) => s.id));
    for (const [id, slot] of this.warehouses) if (!ids.has(id)) this.leaveWarehouse(id, slot);

    let waiting = 0;
    for (const subagent of [...subagents].sort((a, b) => a.startedAt - b.startedAt)) {
      const existing = this.warehouses.get(subagent.id);
      if (existing) {
        existing.warehouse.update(subagent, nowMs);
        continue;
      }
      const slot = this.freeSlot();
      if (slot === null || this.exit) {
        waiting++;
        continue;
      }
      const warehouse = new Warehouse(subagent, this.accent);
      const [x, z] = WAREHOUSE_SLOTS[slot];
      warehouse.group.position.set(x, 0, z);
      this.body.add(warehouse.group);
      this.warehouses.set(subagent.id, { warehouse, slot });
    }

    if (waiting !== this.overflow) {
      this.overflow = waiting;
      this.drawSign();
    }
  }

  // A leaving warehouse keeps its slot until it has shrunk away.
  private leaveWarehouse(id: string, slot: Slot) {
    this.warehouses.delete(id);
    this.leavingWarehouses.add(slot);
    slot.warehouse.remove(() => {
      this.leavingWarehouses.delete(slot);
      this.body.remove(slot.warehouse.group);
      slot.warehouse.dispose();
    });
  }

  // Yard workers follow the session; each warehouse worker follows its subagent.
  private workerBusyFlags(): boolean[] {
    const lotBusy = this.state.status === "busy" && !this.exit;
    const slotBusy = new Array(MAX_WAREHOUSES).fill(false);
    for (const { warehouse, slot } of this.warehouses.values()) slotBusy[slot] = warehouse.state.status === "busy" && !this.exit;
    return [lotBusy, lotBusy, lotBusy, lotBusy, ...slotBusy];
  }

  private freeSlot(): number | null {
    const used = new Set([...this.warehouses.values(), ...this.leavingWarehouses].map((s) => s.slot));
    for (let slot = 0; slot < MAX_WAREHOUSES; slot++) if (!used.has(slot)) return slot;
    return null;
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
    this.sign.element.style.opacity = String(1 - k); // labels are never hidden by the ground
    if (k >= 1) {
      this.gone = true;
      this.exit.onGone();
    }
  }

  // ---------- Sign ----------

  // An HTML label that follows the hall. `dispose` removes its element.
  private createSign() {
    const element = document.createElement("div");
    element.className = "lot-label";
    element.style.setProperty("--accent", `#${this.accent.getHexString()}`);
    const name = document.createElement("span");
    const badge = document.createElement("span");
    badge.className = "badge";
    element.append(name, badge);
    const label = new CSS2DObject(element);
    label.position.set((HALL.x0 + HALL.x1) / 2, HALL_TOP + 4, (HALL.z0 + HALL.z1) / 2);
    this.body.add(label);
    return { element, name, badge };
  }

  private drawSign() {
    this.sign.name.textContent = this.state.name;
    this.sign.badge.textContent = this.overflow > 0 ? `+${this.overflow}` : "";
    this.sign.badge.hidden = this.overflow === 0;
  }
}
