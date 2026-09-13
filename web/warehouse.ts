// A subagent's small warehouse inside its parent's yard.

import * as THREE from "three";
import type { AgentState } from "../server/types.ts";
import { Activity } from "./activity.ts";
import { CARGO_MATERIAL, mergedGroup, Searchlight, Stacks, YARD_Y } from "./machines.ts";
import { createWallMaterial, MATERIALS, repeatUv, standard } from "./palette.ts";
import { StaticBuilder } from "./static-builder.ts";

export const WAREHOUSE = { width: 6, height: 3.4, depth: 5 };
const STRIPE = 0.5;

type Part = "door" | "stack" | "lamp" | "fan";
const TOOL_PARTS: Record<string, Part> = {
  Edit: "door",
  Write: "door",
  NotebookEdit: "door",
  Bash: "stack",
  Read: "lamp",
  Grep: "lamp",
  Glob: "lamp",
};

export class Warehouse {
  readonly group = new THREE.Group();
  readonly pickables: THREE.Mesh[] = [];
  state: AgentState;
  gone = false;

  private body = new THREE.Group();
  private busy = new Activity();
  private parts: Record<Part, Activity> = { door: new Activity(), stack: new Activity(), lamp: new Activity(), fan: new Activity() };
  private wallMaterial = createWallMaterial();
  private accentMaterial: THREE.MeshStandardMaterial;
  private accent: THREE.Color;
  private grey: THREE.Color;

  private stack: Stacks;
  private lamp: Searchlight;
  private door: THREE.Group;
  private pallet: THREE.Group;
  private blades: THREE.Group;
  private palletPhase = 0;

  private appear = 0;
  private exit: { t: number; onGone: () => void } | null = null;

  constructor(state: AgentState, accent: THREE.Color) {
    this.state = state;
    this.accent = accent.clone();
    const l = accent.r * 0.3 + accent.g * 0.59 + accent.b * 0.11;
    this.grey = new THREE.Color(l, l, l);
    this.accentMaterial = standard(this.accent);
    this.accentMaterial.userData.separate = true; // its color animates

    const { width: w, height: h, depth: d } = WAREHOUSE;
    const top = YARD_Y + STRIPE + h;
    const builder = new StaticBuilder();

    builder.box(this.accentMaterial, [0, YARD_Y + STRIPE / 2, 0], [w + 0.08, STRIPE, d + 0.08]);
    const wall = (length: number) => repeatUv(new THREE.PlaneGeometry(length, h), length / 2.2, 1);
    const wallY = YARD_Y + STRIPE + h / 2;
    builder.add(wall(w), this.wallMaterial, [0, wallY, d / 2]);
    builder.add(wall(w), this.wallMaterial, [0, wallY, -d / 2], [1, 1, 1], [0, Math.PI, 0]);
    builder.add(wall(d), this.wallMaterial, [w / 2, wallY, 0], [1, 1, 1], [0, Math.PI / 2, 0]);
    builder.add(wall(d), this.wallMaterial, [-w / 2, wallY, 0], [1, 1, 1], [0, -Math.PI / 2, 0]);
    builder.box(MATERIALS.roof, [0, top + 0.1, 0], [w, 0.2, d]);
    for (const s of [-1, 1]) {
      builder.box(MATERIALS.parapet, [0, top + 0.3, s * (d / 2 - 0.1)], [w, 0.4, 0.2]);
      builder.box(MATERIALS.parapet, [s * (w / 2 - 0.1), top + 0.3, 0], [0.2, 0.4, d]);
    }
    builder.box(MATERIALS.frame, [-0.6, top + 0.45, -0.8], [1.3, 0.5, 1.3]); // fan housing

    this.stack = new Stacks(builder, [w / 2 - 1, -d / 2 + 1], { count: 1, height: top + 1.8 - YARD_Y, radius: 0.3, frame: false });
    this.lamp = new Searchlight(builder, [-w / 2 + 0.6, d / 2 - 0.6], {
      tower: false,
      height: top + 1.2 - YARD_Y,
      reach: 3.5,
      aimAt: [-w / 2 + 0.6, d / 2 + 10],
    });

    const statics = builder.build();
    for (const mesh of statics.children as THREE.Mesh[]) {
      if (mesh.material === this.wallMaterial || mesh.material === MATERIALS.roof) this.pickables.push(mesh);
    }

    // Roller door, anchored at its top so it rolls up.
    this.door = new THREE.Group();
    this.door.position.set(1.2, YARD_Y + STRIPE + 2.6, d / 2 + 0.06);
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6 + STRIPE, 0.1), this.accentMaterial);
    doorMesh.position.y = -(2.6 + STRIPE) / 2;
    this.door.add(doorMesh);

    this.pallet = mergedGroup((b) => {
      b.box(MATERIALS.wood, [0, YARD_Y + 0.07, 0], [1, 0.14, 1]);
      b.box(CARGO_MATERIAL, [0, YARD_Y + 0.5, 0], [0.9, 0.7, 0.9]);
    });
    this.pallet.position.set(1.2, 0, d / 2 - 0.6);

    this.blades = mergedGroup((b) => {
      for (let i = 0; i < 2; i++) b.box(MATERIALS.darkSteel, [0, 0, 0], [1.1, 0.04, 0.18], [0, (i * Math.PI) / 2, 0]);
    });
    this.blades.position.set(-0.6, top + 0.75, -0.8);

    this.body.add(statics, this.stack.group, this.lamp.group, this.door, this.pallet, this.blades);
    for (const mesh of this.pickables) mesh.userData.hover = this;
    this.body.scale.setScalar(0.001);
    this.group.add(this.body);
    this.update(state, performance.now());
  }

  update(state: AgentState, nowMs: number) {
    this.state = state;
    const working = state.status === "busy";
    this.busy.set(working, nowMs);
    const active = working && state.currentTool ? (TOOL_PARTS[state.currentTool.name] ?? "fan") : null;
    for (const part of Object.keys(this.parts) as Part[]) this.parts[part].set(part === active, nowMs);
  }

  remove(onGone: () => void) {
    if (this.exit) return;
    this.busy.set(false, 0);
    for (const part of Object.values(this.parts)) part.set(false, 0);
    this.exit = { t: 0, onGone };
  }

  tick(dt: number, nowMs: number) {
    if (this.gone) return;
    const busy = this.busy.update(dt, nowMs);
    const door = this.parts.door.update(dt, nowMs);
    const stack = this.parts.stack.update(dt, nowMs);
    const lamp = this.parts.lamp.update(dt, nowMs);
    const fan = this.parts.fan.update(dt, nowMs);

    this.wallMaterial.emissiveIntensity = busy * 1.1;
    this.accentMaterial.color.copy(this.accent).lerp(this.grey, (1 - busy) * 0.35);

    this.door.scale.y = 1 - door * 0.85;
    this.palletPhase += dt * 0.5 * door;
    const slide = (Math.sin(this.palletPhase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    this.pallet.position.z = WAREHOUSE.depth / 2 - 0.6 + slide * 2.2 * door;

    this.stack.tick(dt, busy, stack);
    this.lamp.tick(dt, lamp);
    this.blades.rotation.y += dt * (0.6 * busy + 12 * fan);

    this.tickLifecycle(dt);
  }

  dispose() {
    this.wallMaterial.dispose();
    this.accentMaterial.dispose();
    this.stack.dispose();
    this.lamp.dispose();
    // Own geometry only; smoke pools share one puff geometry.
    this.body.traverse((child) => {
      if (child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh)) child.geometry.dispose();
    });
  }

  private tickLifecycle(dt: number) {
    if (!this.exit) {
      this.appear = Math.min(1, this.appear + dt / 0.5);
      this.body.scale.setScalar(Math.max(0.001, easeOutBack(this.appear)));
      return;
    }
    this.exit.t += dt;
    const k = Math.min(1, this.exit.t / 0.4);
    this.body.scale.setScalar(Math.max(0.001, 1 - k));
    if (k >= 1) {
      this.gone = true;
      this.exit.onGone();
    }
  }
}

export function easeOutBack(t: number) {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}
