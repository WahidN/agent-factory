// The inside of one user's head office: a floor of the tower in hq.ts, with a
// desk per session of that user and a robot behind every desk. It is a scene
// of its own with a camera of its own, handed to the renderer by scene.ts
// while you are inside.
//
// Only your own office can be entered, so at most one of these exists and it
// only exists while you are in it. That is why everything here is built in
// full, rebuilt when the desks change, and thrown away on the way out.

import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import type { SessionState } from "../server/types.ts";
import { Hands } from "./hands.ts";
import {
  deskPhase,
  deskSpots,
  DESK,
  doorSpot,
  officeRoom,
  robotSpot,
  type Spot,
  subagentSpots,
} from "./office-layout.ts";
import { accentFor, MATERIALS, standard, WALL_TINTS } from "./palette.ts";
import { wallTintIndexFor } from "./park-layout.ts";
import { hashString } from "./plots.ts";
import { Robot, ROBOT } from "./robot.ts";
import { DeskScreen } from "./screen.ts";
import { RoofSign } from "./roof-sign.ts";
import { SKY_COLOR } from "./scene.ts";
import { StaticBuilder } from "./static-builder.ts";
import { type Box, EYE_HEIGHT, HeldKeys, step, type Walker, WALKER_RADIUS } from "./walk.ts";

const CEILING = 3.6; // floor to ceiling, high enough for the name sign on the back wall
const WALL = 0.3; // wall thickness, thicker than one walking step
const WINDOW = { sill: 1.1, head: 2.6 }; // the band you see the sky through

const DESK_TOP = 0.75;
// `back` is how far the monitor stands from the middle of the desk, away from
// the robot; `offset` is how far it sits to one side of the head in front of
// it. The laptop is open between the two.
const MONITOR = { width: 0.6, height: 0.36, offset: 0.5, back: 0.24 };
const LAPTOP = { width: 0.44, height: 0.28 };

// Shared by every office: plain colours that never change with the user.
const carpet = standard("#606a78", { roughness: 1 });
const plant = standard("#3f7048", { roughness: 1 });
const counter = standard("#b9ac95", { roughness: 0.85 });
// The door frame stands behind the light that lights the room, which would
// throw its arch across the whole floor.
const doorTrim = standard("#3a4048");
doorTrim.userData.castShadow = false;
const ceiling = standard("#e8e6df", { roughness: 0.95 });
const panel = standard("#fffaf0", { emissive: "#fff6e0", emissiveIntensity: 0.9 });
// The light hangs under the ceiling, so the ceiling is behind it. Casting from
// it would drop a shadow over the whole floor.
ceiling.userData.castShadow = false;
panel.userData.castShadow = false;
const deskTop = standard("#cfc3ae", { roughness: 0.8 });
const chairFabric = standard("#2f3844");

export class Office {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
  readonly controls: PointerLockControls;

  private tint: string;
  private structure = new THREE.Group();
  private sign: RoofSign | null = null;
  private desks: Desk[] = [];
  private keys = new HeldKeys();
  private walker: Walker = { x: 0, z: 0 };
  private room = { halfX: 10, halfZ: 9, blockers: [] as Box[] };
  // The ids the floor was built for, in order. A change in this list moves
  // every desk, so it is what decides a rebuild.
  private builtFor = "";
  // Whether you have been put on the floor yet. Only the first build walks you
  // in at the door.
  private placed = false;
  private sun: THREE.DirectionalLight;
  private hands: Hands;

  constructor(
    private user: string,
    canvas: HTMLCanvasElement,
  ) {
    this.tint = WALL_TINTS[wallTintIndexFor(user)];
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.add(new THREE.HemisphereLight("#fdfaf2", "#8a8f9c", 2.2));
    // The room's own daylight, steeply from above. The ceiling and the walls
    // are told not to cast (see their materials), so the light reaches the
    // floor through them; a light hung low inside would take a counter beside
    // it and throw its shadow across the whole room.
    this.sun = new THREE.DirectionalLight("#ffeccf", 1.9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.controls = new PointerLockControls(this.camera, canvas);
    this.keys.attach();
    // Your own hands hang off the camera, and a camera only draws its children
    // when it is in the scene itself.
    this.hands = new Hands(this.tint);
    this.camera.add(this.hands.group);
    this.scene.add(this.camera, this.structure);
    this.build([]);
  }

  // ---------- What the floor shows ----------

  /** Every session of this office's user, in a stable order. */
  setSessions(sessions: SessionState[]) {
    const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
    const key = ordered.map((session) => `${session.id}:${session.subagents}`).join("\n");
    if (key !== this.builtFor) {
      this.build(ordered);
      return;
    }
    for (const [i, session] of ordered.entries()) this.desks[i].update(session);
  }

  tick(dt: number, now: number) {
    const yaw = new THREE.Euler().setFromQuaternion(this.camera.quaternion, "YXZ").y;
    const next = step(this.walker, this.keys.keys, yaw, dt, this.room);
    // How far you actually moved, not how far you asked to: walking into a
    // desk stops the swing of your arms with you.
    this.hands.tick(Math.hypot(next.x - this.walker.x, next.z - this.walker.z), now);
    this.walker = next;
    this.camera.position.set(this.walker.x, EYE_HEIGHT, this.walker.z);
    for (const desk of this.desks) desk.tick(now);
  }

  lock() {
    this.controls.lock();
  }

  unlock() {
    if (this.controls.isLocked) this.controls.unlock();
  }

  get isLocked(): boolean {
    return this.controls.isLocked;
  }

  dispose() {
    this.keys.detach();
    this.controls.dispose();
    this.hands.dispose();
    this.clear();
  }

  // ---------- Building ----------

  private build(sessions: SessionState[]) {
    this.clear();
    this.builtFor = sessions.map((session) => `${session.id}:${session.subagents}`).join("\n");

    const size = officeRoom(sessions.length);
    this.room = { halfX: size.width / 2 - WALL / 2, halfZ: size.depth / 2 - WALL / 2, blockers: [] };
    const b = new StaticBuilder();
    this.buildShell(b, size);

    const spots = deskSpots(sessions.length);
    for (const [i, session] of sessions.entries()) {
      const desk = new Desk(session, spots[i], this.tint);
      this.desks.push(desk);
      this.structure.add(desk.group);
      this.room.blockers.push(...desk.blockers);
      desk.build(b);
    }

    // The name in letters against the back wall, the same sign the halls and
    // the tower outside spell with.
    this.sign = new RoofSign(this.user, 5.5);
    this.sign.group.position.set(0, 0, -size.depth / 2 + 0.9);
    this.structure.add(this.sign.group);

    const statics = b.build();
    this.structure.add(statics);

    // Where you stand is settled here too, so a rebuild can never leave you
    // outside the room. The first build puts you at the door; a rebuild while
    // you are already walking keeps you where you are, only pulling you back
    // inside a room that shrank. A desk built around you is walked out of on
    // the first step.
    if (this.placed) {
      this.walker = {
        x: clamp(this.walker.x, this.room.halfX - WALKER_RADIUS),
        z: clamp(this.walker.z, this.room.halfZ - WALKER_RADIUS),
      };
    } else {
      this.walker = { ...doorSpot(sessions.length) };
      this.placed = true;
    }
    this.camera.position.set(this.walker.x, EYE_HEIGHT, this.walker.z);

    const reach = Math.max(size.width, size.depth);
    this.sun.position.set(size.width * 0.2, 16, size.depth * 0.25);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 40;
    Object.assign(this.sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach });
    this.sun.shadow.camera.updateProjectionMatrix();
  }

  // Floor, ceiling with light panels, four walls with a window band, and a
  // door frame in the wall you came in through.
  private buildShell(b: StaticBuilder, size: { width: number; depth: number }) {
    const { width, depth } = size;
    b.box(carpet, [0, -0.05, 0], [width, 0.1, depth]);
    b.box(ceiling, [0, CEILING + 0.05, 0], [width, 0.1, depth]);
    for (let z = -depth / 2 + 3; z < depth / 2 - 1; z += 4) {
      b.box(panel, [0, CEILING - 0.06, z], [width * 0.5, 0.06, 0.5]);
    }

    // A wall in three bands: solid to the sill, glass to the head, solid to
    // the ceiling. The glass is what makes it read as a floor high up, and the
    // solid bands are the user's own tint, the one the halls outside wear.
    const skin = standard(this.tint);
    // The walls stand between the light and the floor, and a room lit from
    // inside would otherwise be striped by the shadows of its own walls.
    skin.userData.castShadow = false;
    const wall = (length: number, x: number, z: number, turned: boolean) => {
      const sx = turned ? WALL : length;
      const sz = turned ? length : WALL;
      const band = (material: THREE.Material, y: number, height: number) => {
        b.box(material, [x, y, z], [sx, height, sz]);
      };
      band(skin, WINDOW.sill / 2, WINDOW.sill);
      band(MATERIALS.glass, (WINDOW.sill + WINDOW.head) / 2, WINDOW.head - WINDOW.sill);
      band(skin, (WINDOW.head + CEILING) / 2, CEILING - WINDOW.head);

      // Mullions and a sill, or the band is a painted stripe instead of a
      // window you are standing in front of.
      const mullion: [number, number, number] = turned ? [WALL + 0.04, 0, 0.1] : [0.1, 0, WALL + 0.04];
      const bays = Math.max(2, Math.round(length / 2.4));
      for (let i = 1; i < bays; i++) {
        const along = -length / 2 + (length / bays) * i;
        const mx = turned ? x : x + along;
        const mz = turned ? z + along : z;
        b.box(
          MATERIALS.frame,
          [mx, (WINDOW.sill + WINDOW.head) / 2, mz],
          [mullion[0], WINDOW.head - WINDOW.sill, mullion[2]],
        );
      }
      for (const y of [WINDOW.sill, WINDOW.head]) {
        b.box(MATERIALS.frame, [x, y, z], [turned ? WALL + 0.04 : length, 0.1, turned ? length : WALL + 0.04]);
      }
    };

    wall(width, 0, -depth / 2, false);
    wall(width, 0, depth / 2, false);
    wall(depth, -width / 2, 0, true);
    wall(depth, width / 2, 0, true);

    // The way you came in, in the +z wall. It does not open: the way out is
    // the control on screen.
    for (const x of [-1.1, 1.1]) b.box(doorTrim, [x, 1.15, depth / 2], [0.16, 2.3, WALL + 0.1]);
    b.box(doorTrim, [0, 2.35, depth / 2], [2.4, 0.16, WALL + 0.1]);

    this.buildFurniture(b, size);
  }

  // What stands between the door and the desks. A floor for one session is
  // still a whole floor of the tower, so without this you walk into an empty
  // hall. It is the same handful of boxes whatever the desk count is.
  private buildFurniture(b: StaticBuilder, size: { width: number; depth: number }) {
    const { width, depth } = size;
    const front = depth / 2 - 3.4;

    // Reception counter, to the left of the door as you come in.
    const desk = { x: -width / 2 + 3.2, z: front };
    b.box(counter, [desk.x, 0.52, desk.z], [3, 1.04, 0.7]);
    b.box(MATERIALS.white, [desk.x, 1.07, desk.z], [3.2, 0.06, 0.9]);
    this.room.blockers.push({ x: desk.x, z: desk.z, halfX: 1.6, halfZ: 0.45 });

    // Coffee corner against the other wall, with a plant beside it.
    const bar = { x: width / 2 - 2.4, z: front };
    b.box(counter, [bar.x, 0.45, bar.z], [2.2, 0.9, 0.6]);
    b.box(MATERIALS.darkSteel, [bar.x - 0.6, 1.08, bar.z], [0.4, 0.36, 0.34]); // the machine
    b.box(MATERIALS.white, [bar.x + 0.5, 0.98, bar.z], [0.5, 0.16, 0.3]); // a tray of cups
    this.room.blockers.push({ x: bar.x, z: bar.z, halfX: 1.1, halfZ: 0.4 });

    // A meeting table in the middle of the open floor, between the door and
    // the desks. Without it the walk in is a long empty carpet.
    const table = { x: 0, z: depth / 2 - 7 };
    b.box(deskTop, [table.x, 0.74, table.z], [2.6, 0.07, 1.3]);
    for (const sx of [-1, 1]) {
      b.box(MATERIALS.steel, [table.x + sx * 1.1, 0.37, table.z], [0.08, 0.74, 1.1]);
    }
    this.room.blockers.push({ x: table.x, z: table.z, halfX: 1.3, halfZ: 0.65 });
    for (const sx of [-0.8, 0.8]) {
      for (const sz of [-1.1, 1.1]) {
        b.box(chairFabric, [table.x + sx, 0.45, table.z + sz], [0.44, 0.07, 0.44]);
        b.box(chairFabric, [table.x + sx, 0.75, table.z + sz * 1.25], [0.44, 0.52, 0.07]);
        for (const lx of [-0.16, 0.16]) {
          for (const lz of [-0.16, 0.16]) {
            b.box(MATERIALS.steel, [table.x + sx + lx, 0.22, table.z + sz + lz], [0.05, 0.45, 0.05]);
          }
        }
        this.room.blockers.push({ x: table.x + sx, z: table.z + sz, halfX: 0.3, halfZ: 0.3 });
      }
    }

    // A plant in each corner and one either side of the meeting table, so the
    // floor is not one flat carpet with furniture pushed to the walls.
    const pots: Spot[] = [];
    for (const x of [-width / 2 + 1.4, width / 2 - 1.4]) {
      for (const z of [-depth / 2 + 1.4, depth / 2 - 1.4]) pots.push({ x, z });
    }
    pots.push({ x: -4.2, z: table.z }, { x: 4.2, z: table.z });
    for (const pot of pots) {
      b.cylinder(MATERIALS.concrete, [pot.x, 0.25, pot.z], [0.28, 0.5, 0.28]);
      b.cone(plant, [pot.x, 1.1, pot.z], [0.55, 1.3, 0.55]);
      this.room.blockers.push({ x: pot.x, z: pot.z, halfX: 0.3, halfZ: 0.3 });
    }
  }

  private clear() {
    this.structure.traverse((child) => {
      if (child.userData.sharedGeometry) return;
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    for (const desk of this.desks) desk.dispose();
    this.desks = [];
    this.sign?.dispose();
    this.sign = null;
    this.scene.remove(this.structure);
    this.structure = new THREE.Group();
    this.scene.add(this.structure);
  }
}

function clamp(value: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, value));
}

// One session: a desk with a monitor and a laptop, a chair with a robot on it
// and one smaller robot per subagent. Everything about it is set here, so
// nothing else has to know how a desk is put together.
//
// The robot sits on the door side of its desk with its back to you, which is
// what puts both screens in view as you walk in. Turn it round and you would
// be looking at the backs of three monitors.
class Desk {
  readonly group = new THREE.Group();
  readonly blockers: Box[] = [];

  private robot: Robot;
  private subagents: Robot[] = [];
  private screen: DeskScreen;
  private panels: THREE.Mesh[] = [];
  private spot: { x: number; z: number };
  private busy = false;

  constructor(session: SessionState, spot: { x: number; z: number }, tint: string) {
    this.spot = spot;
    const phase = deskPhase(session.id);
    // One canvas for both screens, so the monitor and the laptop show the same
    // work and a desk costs one texture.
    this.screen = new DeskScreen(accentFor(session.project), hashString(session.id));

    const monitor = new THREE.Mesh(new THREE.PlaneGeometry(MONITOR.width, MONITOR.height), this.screen.material);
    monitor.position.set(spot.x + MONITOR.offset, DESK_TOP + 0.44, spot.z - MONITOR.back + 0.03);
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(LAPTOP.width, LAPTOP.height), this.screen.material);
    lid.position.set(spot.x - 0.22, DESK_TOP + 0.14, spot.z + 0.06);
    lid.rotation.x = -0.28; // tipped back, the way a laptop stands open
    this.panels.push(monitor, lid);
    this.group.add(monitor, lid);

    this.robot = new Robot(tint, phase);
    const seat = robotSpot(spot);
    this.robot.group.position.set(seat.x, 0, seat.z);
    this.robot.group.rotation.y = Math.PI; // facing its desk, back to the door
    this.group.add(this.robot.group);
    this.blockers.push(
      { x: spot.x, z: spot.z, halfX: DESK.width / 2, halfZ: DESK.depth / 2 },
      { x: seat.x, z: seat.z, halfX: ROBOT.radius, halfZ: ROBOT.radius },
    );

    for (const [i, at] of subagentSpots(spot, session.subagents).entries()) {
      const helper = new Robot(tint, phase + i + 1, ROBOT.subagentScale);
      helper.group.position.set(at.x, 0, at.z);
      // Turned toward the desk they are helping at, over their shoulder.
      helper.group.rotation.y = Math.PI + (at.x < spot.x ? -0.5 : 0.5);
      this.subagents.push(helper);
      this.group.add(helper.group);
      this.blockers.push({ x: at.x, z: at.z, halfX: ROBOT.radius * 0.8, halfZ: ROBOT.radius * 0.8 });
    }

    this.update(session);
  }

  // The still parts go into the office's own builder, so thirty desks merge
  // into the same handful of meshes as the room around them.
  build(b: StaticBuilder) {
    const { x, z } = this.spot;
    b.box(deskTop, [x, DESK_TOP, z], [DESK.width, 0.06, DESK.depth]);
    for (const side of [-1, 1]) {
      b.box(MATERIALS.steel, [x + side * (DESK.width / 2 - 0.1), DESK_TOP / 2, z], [0.06, DESK_TOP, DESK.depth - 0.1]);
    }

    // The monitor stands at the far edge on one side, so it does not hide the
    // head behind it, with the laptop open in front of the robot.
    const monitor = x + MONITOR.offset;
    b.box(MATERIALS.darkSteel, [monitor, DESK_TOP + 0.05, z - MONITOR.back], [0.18, 0.04, 0.14]); // foot
    b.box(MATERIALS.darkSteel, [monitor, DESK_TOP + 0.2, z - MONITOR.back], [0.05, 0.3, 0.05]); // stem
    b.box(
      MATERIALS.darkSteel,
      [monitor, DESK_TOP + 0.44, z - MONITOR.back],
      [MONITOR.width + 0.04, MONITOR.height + 0.04, 0.03],
    ); // casing behind the picture

    b.box(MATERIALS.darkSteel, [x - 0.22, DESK_TOP + 0.04, z + 0.22], [LAPTOP.width, 0.03, 0.26]); // laptop base
    b.box(MATERIALS.white, [x - 0.22, DESK_TOP + 0.06, z + 0.24], [LAPTOP.width - 0.06, 0.01, 0.16]); // its keys
    b.box(
      MATERIALS.darkSteel,
      [x - 0.22, DESK_TOP + 0.14, z + 0.05],
      [LAPTOP.width, LAPTOP.height, 0.02],
      [-0.28, 0, 0],
    ); // lid

    // The chair the robot sits on, on the door side of the desk.
    const seat = robotSpot(this.spot);
    b.cylinder(MATERIALS.darkSteel, [seat.x, 0.03, seat.z], [0.24, 0.06, 0.24]);
    b.cylinder(MATERIALS.darkSteel, [seat.x, 0.22, seat.z], [0.04, 0.34, 0.04]);
    b.box(chairFabric, [seat.x, ROBOT.seat - 0.03, seat.z], [0.46, 0.06, 0.44]);
    // The back is on the door side of the seat, behind the robot: it faces its
    // desk, so its own back is the side you walk up to.
    b.box(chairFabric, [seat.x, ROBOT.seat + 0.3, seat.z + 0.22], [0.46, 0.6, 0.07]);
  }

  update(session: SessionState) {
    const busy = session.status === "busy";
    if (busy === this.busy) return;
    this.busy = busy;
    this.screen.setBusy(busy);
    this.robot.setBusy(busy);
    for (const helper of this.subagents) helper.setBusy(busy);
  }

  tick(now: number) {
    this.screen.tick(now);
    this.robot.tick(now);
    for (const helper of this.subagents) helper.tick(now);
  }

  dispose() {
    for (const panel of this.panels) panel.geometry.dispose();
    this.screen.dispose();
  }
}
