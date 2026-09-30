// One user's head office: a tower on a paved block, one floor for every row
// of the token ladder that user has earned, plus the four ladder rows that are
// too big for a yard (flag, helipad, turbine, blimp).
//
// There is one HQ per user and not one per session, so a park holds a handful
// of them. That is why an HQ is always built in full and has no far level the
// way a lot does.

import * as THREE from "three";
import { YARD_Y } from "./machines.ts";
import { hqFloors, milestoneIndex } from "./milestone-ladder.ts";
import { type Animated, buildHqMilestones } from "./milestones.ts";
import { createWallMaterial, MATERIALS, repeatUv, standard, WALL_BAY, WALL_TINTS } from "./palette.ts";
import { YARD_HALF } from "./park.ts";
import { wallTintIndexFor } from "./park-layout.ts";
import { RoofSign } from "./roof-sign.ts";
import { StaticBuilder } from "./static-builder.ts";
import type { HqHover } from "./tooltip.ts";

// One floor is one row of windows, the same 6 units a hall's wall bay is, so
// the bay texture tiles on a tower exactly as it does on a hall.
const FLOOR = WALL_BAY.height;
const PLINTH = 1; // coloured base stripe, as a hall has

// The tower stands at the back of the block with its entrance facing the
// street at +z. 20 by 18 keeps an eleven floor tower from reading as a
// needle, and leaves the helicopter's rotor its clearance on the roof.
const TOWER = { x0: -10, z0: -17, x1: 10, z1: 1 };
const DOOR_X = (TOWER.x0 + TOWER.x1) / 2;

const RISE_SECONDS = 1;

// Shared by every HQ, so two of them merge into the same draw call.
const paving = standard("#a9a69c", { roughness: 0.95 });
const lawn = standard("#6c984b", { roughness: 1 });
const hedge = standard("#3d6f43", { roughness: 1 });

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

export class Hq {
  readonly group = new THREE.Group();
  gone = false;

  private body = new THREE.Group();
  private structure = new THREE.Group();
  // The moving ladder rows: the turbine and the blimp.
  private extras: Animated[] = [];
  // Which row of the ladder the tower was built for. The whole HQ is rebuilt
  // when the total crosses a row, because that is what adds a floor.
  private builtRow = -1;
  private user: string;
  private tokens: number;
  // How many sessions of this user are on the park. Shown in the tooltip, so
  // it is kept current without rebuilding anything.
  private agents = 0;
  // Deep enough to take everything the HQ holds under the ground: the roof
  // letters stand over the tower and the blimp floats well over those, so it
  // is measured off the built structure. A lot sinks a fixed 12, which would
  // leave the upper floors of an eleven floor tower hanging.
  private sinkDepth = 0;

  private wallMaterial: THREE.MeshStandardMaterial;
  private accentMaterial: THREE.MeshStandardMaterial;
  // The user's name in letters on the roof. Rebuilt with the tower, because
  // the roof it stands on moves up a floor.
  private roofSign!: RoofSign;
  // The tower's own meshes, the only part of the block the pointer can hit.
  private pickableMeshes: THREE.Mesh[] = [];
  private pickablesDirty = false;

  private appear = 0;
  private exit: { t: number; onGone: () => void } | null = null;

  // Set whenever this HQ moves a shadow caster outside the frame loop's own
  // checks, and read once by main.ts's tick loop, which resets it.
  private shadowDirty = false;

  constructor(user: string, tokens: number, agents = 1) {
    this.user = user;
    this.tokens = tokens;
    this.agents = agents;
    const tint = WALL_TINTS[wallTintIndexFor(user)];
    this.wallMaterial = createWallMaterial(tint);
    // An HQ has no busy state to follow, so its windows keep one soft glow.
    // A tower with every window dark reads as derelict from across the park.
    this.wallMaterial.emissiveIntensity = 0.45;
    this.accentMaterial = standard(tint);
    // Its own mesh instead of being baked in with the rest: the plinth,
    // pilasters and canopy are what the pointer hits, and the plaza, lawns
    // and planters must stay out of the tooltip.
    this.accentMaterial.userData.separate = true;

    this.buildStructure();
    this.body.position.y = -this.sinkDepth;
    this.group.add(this.body);
  }

  // What the tooltip shows. An HQ has no session, so it answers for the user
  // it belongs to.
  get hq(): HqHover {
    return { user: this.user, agents: this.agents, tokens: this.tokens };
  }

  pickables(): THREE.Mesh[] {
    return this.pickableMeshes;
  }

  // Rebuilds in place when the total crosses a ladder row, which is the only
  // thing that changes the building. The agent count only changes its tooltip.
  update(tokens: number, agents: number) {
    this.tokens = tokens;
    this.agents = agents;
    if (milestoneIndex(tokens) === this.builtRow) return;
    this.disposeStructure();
    this.buildStructure();
    this.shadowDirty = true;
  }

  relocate(x: number, z: number) {
    if (this.group.position.x === x && this.group.position.z === z) return;
    this.group.position.set(x, 0, z);
    this.shadowDirty = true;
  }

  tick(dt: number) {
    if (this.gone) return;
    for (const extra of this.extras) extra.tick(dt);
    this.tickLifecycle(dt);
  }

  remove(onGone: () => void) {
    if (this.exit) return;
    this.exit = { t: 0, onGone };
  }

  dispose() {
    // redistribute() can dispose a lot mid-frame for the same reason: the
    // frame loop may still hold this HQ from before the call.
    this.gone = true;
    this.disposeStructure();
    this.wallMaterial.dispose();
    this.accentMaterial.dispose();
  }

  // True once, the first time it is called after this HQ moved a shadow
  // caster. main.ts's frame loop uses it to redraw the shadow map only on the
  // frames that need it.
  consumeShadowDirty(): boolean {
    if (!this.shadowDirty) return false;
    this.shadowDirty = false;
    return true;
  }

  // Same one-shot pattern, for main.ts's pickables cache: a rebuild hands the
  // tower a fresh set of meshes.
  consumePickablesDirty(): boolean {
    if (!this.pickablesDirty) return false;
    this.pickablesDirty = false;
    return true;
  }

  // ---------- Building ----------

  private buildStructure() {
    const builder = new StaticBuilder();
    this.builtRow = milestoneIndex(this.tokens);
    this.buildBlock(builder);
    const top = this.buildTower(builder, hqFloors(this.tokens));
    this.extras = buildHqMilestones(builder, this.builtRow, {
      accent: this.accentMaterial,
      tower: { ...TOWER, top },
    });

    // The user's name along the front edge of the roof, clear of the helipad
    // in the middle. The letters sit on the roof surface and face the street.
    this.roofSign = new RoofSign(this.user, TOWER.x1 - TOWER.x0);
    this.roofSign.group.position.set((TOWER.x0 + TOWER.x1) / 2, top + 0.3, TOWER.z1 - 1);

    const statics = builder.build();
    // The tower answers the pointer; the block it stands on does not. The
    // plaza, lawns and planters are baked into one mesh with everything else
    // plain, which is why the accent material is kept separate above.
    const tower: THREE.Material[] = [this.wallMaterial, this.accentMaterial];
    this.pickableMeshes = (statics.children as THREE.Mesh[]).filter((mesh) =>
      tower.includes(mesh.material as THREE.Material),
    );
    for (const mesh of this.pickableMeshes) mesh.userData.hover = this;
    this.pickablesDirty = true;

    this.structure = new THREE.Group();
    this.structure.add(statics, this.roofSign.group, ...this.extras.map((extra) => extra.group));
    // Measured before it is parented, so the box is in the body's own space.
    // The 2 covers the blimp's bob.
    this.sinkDepth = new THREE.Box3().setFromObject(this.structure).max.y + 2;
    this.body.add(this.structure);
  }

  private disposeStructure() {
    this.body.remove(this.structure);
    this.roofSign.dispose();
    // Everything else in here was merged for this HQ alone: the tower for its
    // own floor count, the extras from their own builders. The geometries the
    // builders draw from are cloned on the way in and never end up in the
    // scene. The roof letters are the exception: their geometry comes from a
    // cache every sign in the park spells from, so freeing it here would take
    // the buffers away from every other sign using that letter.
    this.structure.traverse((child) => {
      if (child.userData.sharedGeometry) return;
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    this.extras = [];
    this.pickableMeshes = [];
  }

  // The block the HQ stands on: paved to the same height as a lot's yard, so
  // the flagpole and the turbine, which both measure from YARD_Y, land on it.
  private buildBlock(b: StaticBuilder) {
    const h = YARD_HALF;
    b.box(paving, [0, YARD_Y / 2, 0], [h * 2, YARD_Y, h * 2]);

    // A lawn either side of the path to the door, so the block is not one
    // grey square. The turbine stands on the left one, the flagpole on the
    // right, both at the coordinates they had in a yard.
    for (const x of [-13.5, 13.5]) b.box(lawn, [x, YARD_Y + 0.06, 10], [11, 0.12, 16]);

    // Planters along the path from the door to the street.
    for (const z of [4, 9, 14]) {
      for (const x of [DOOR_X - 4.8, DOOR_X + 4.8]) {
        b.box(MATERIALS.concrete, [x, YARD_Y + 0.35, z], [1.6, 0.7, 1.6]);
        b.box(hedge, [x, YARD_Y + 0.95, z], [1.3, 0.5, 1.3]);
      }
    }
  }

  // Returns the top of the roof slab: what the helipad stands on and what the
  // blimp is moored to.
  private buildTower(b: StaticBuilder, floors: number): number {
    const { x0, z0, x1, z1 } = TOWER;
    const width = x1 - x0;
    const depth = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const wall = floors * FLOOR;
    const top = YARD_Y + PLINTH + wall;

    b.box(this.accentMaterial, [cx, YARD_Y + PLINTH / 2, cz], [width + 0.1, PLINTH, depth + 0.1]);

    const wallY = YARD_Y + PLINTH + wall / 2;
    const plane = (length: number) => repeatUv(new THREE.PlaneGeometry(length, wall), length / WALL_BAY.width, floors);
    b.add(plane(width), this.wallMaterial, [cx, wallY, z1]);
    b.add(plane(width), this.wallMaterial, [cx, wallY, z0], [1, 1, 1], [0, Math.PI, 0]);
    b.add(plane(depth), this.wallMaterial, [x1, wallY, cz], [1, 1, 1], [0, Math.PI / 2, 0]);
    b.add(plane(depth), this.wallMaterial, [x0, wallY, cz], [1, 1, 1], [0, -Math.PI / 2, 0]);

    // Pilasters up the corners and a cornice under the roof, as a hall has,
    // so a tall tower still reads as the same family of building.
    const height = top - YARD_Y;
    for (const x of [x0 + 0.16, x1 - 0.16]) {
      for (const z of [z0 - 0.02, z1 + 0.02]) {
        b.box(this.accentMaterial, [x, YARD_Y + height / 2, z], [0.38, height, 0.18]);
      }
    }
    b.box(this.accentMaterial, [cx, top - 0.18, z1 + 0.08], [width + 0.2, 0.36, 0.18]);
    b.box(this.accentMaterial, [cx, top - 0.18, z0 - 0.08], [width + 0.2, 0.36, 0.18]);

    // Flat roof with a parapet.
    b.box(MATERIALS.roof, [cx, top + 0.15, cz], [width, 0.3, depth]);
    for (const s of [-1, 1]) {
      b.box(MATERIALS.parapet, [cx, top + 0.4, cz + s * (depth / 2 - 0.2)], [width + 0.1, 0.8, 0.4]);
      b.box(MATERIALS.parapet, [cx + s * (width / 2 - 0.2), top + 0.4, cz], [0.4, 0.8, depth + 0.1]);
    }

    // Entrance on the street side: glass doors, a canopy on two posts, and a
    // step onto the forecourt.
    b.box(MATERIALS.glass, [cx, YARD_Y + 1.7, z1 + 0.07], [5, 3.4, 0.14]);
    b.box(this.accentMaterial, [cx, YARD_Y + 3.6, z1 + 1.3], [7, 0.3, 2.8]);
    for (const s of [-1, 1]) b.cylinder(MATERIALS.steel, [cx + s * 3, YARD_Y + 1.8, z1 + 2.5], [0.12, 3.6, 0.12]);
    b.box(MATERIALS.concrete, [cx, YARD_Y + 0.1, z1 + 2.8], [7.4, 0.2, 3.2]);

    return top;
  }

  // ---------- Lifecycle ----------

  // Rises out of the ground when its user's first session appears, sinks back
  // when the last one ends. No overshoot on the way up: a tower of sixty
  // units would bounce a visible six above the ground.
  private tickLifecycle(dt: number) {
    if (!this.exit) {
      const wasRising = this.appear < 1;
      this.appear = Math.min(1, this.appear + dt / RISE_SECONDS);
      this.body.position.y = -this.sinkDepth * (1 - easeOutCubic(this.appear));
      if (wasRising && this.appear >= 1) this.shadowDirty = true;
      return;
    }
    this.exit.t += dt;
    const k = Math.min(1, this.exit.t);
    this.body.position.y = -this.sinkDepth * k * k;
    if (k >= 1) {
      this.gone = true;
      this.exit.onGone();
    }
  }
}
