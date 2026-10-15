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
  DESK,
  DOOR_ZONE,
  deskPhase,
  deskSpots,
  deskZone,
  doorSpot,
  GLASS_X,
  MEETING_DOOR_WIDTH,
  meetingDoorZ,
  meetingRooms,
  meetingScreenZ,
  officeRoom,
  planterSpots,
  robotSpot,
  sideWindowSpots,
  subagentSpots,
  WALKWAY_HALF,
  zoneSpots,
} from "./office-layout.ts";
import {
  addDishwasher,
  addEspressoMachine,
  addKettle,
  addKeyboardAndMouse,
  addMeetingScreen,
  addMicrowave,
  addPrinter,
  addToaster,
  addWhiteboard,
} from "./office-equipment.ts";
import { addPlant, addSoil, KINDS } from "./office-plants.ts";
import { carpetTexture, ceilingTexture, mossNormal, mossTexture, oakTexture } from "./office-textures.ts";
import { accentFor, MATERIALS, standard, WALL_TINTS } from "./palette.ts";
import { wallTintIndexFor } from "./park-layout.ts";
import { hashString } from "./plots.ts";
import { Robot, ROBOT } from "./robot.ts";
import { DeskScreen } from "./screen.ts";
import { RoofSign } from "./roof-sign.ts";
import { SKY_COLOR } from "./scene.ts";
import { StaticBuilder } from "./static-builder.ts";
import { type Box, EYE_HEIGHT, HeldKeys, step, type Walker, WALKER_RADIUS } from "./walk.ts";

const EAVE = 2.4; // where the sloped ceiling meets a long wall
const RIDGE = 5.5; // the middle of the hall, the highest the ceiling goes
const WALL = 0.3; // wall thickness, thicker than one walking step
const GLASS_HEIGHT = 2.6;
const DOOR_HEIGHT = 2.1;
const MOSS_X = 3; // the moss wall and the glass beside the door stand this far off the walkway

const DESK_TOP = 0.75;
// `back` is how far the monitor stands from the middle of the desk, away from
// the robot; `offset` is how far it sits to one side of the head in front of
// it. The laptop is open between the two.
const MONITOR = { width: 0.6, height: 0.36, offset: 0.5, back: 0.24 };
const LAPTOP = { width: 0.44, height: 0.28 };

// Everything that hangs from or lines the ceiling stays out of the sun's
// shadow pass: the one light sits above the roof, so a casting ceiling would
// black out the room. `separate` keeps the piece out of the merged mesh, which
// is the only place the flag is read.
function noShadow(material: THREE.Material): THREE.Material {
  material.userData.castShadow = false;
  material.userData.separate = true;
  return material;
}

// Shared by every office: plain colours that never change with the user.
const oakFloor = standard("#ffffff", { roughness: 0.9, map: oakTexture });
const walkway = standard("#ffffff", { roughness: 1, map: carpetTexture });
const oak = standard("#ffffff", { roughness: 0.85, map: oakTexture });
const moss = standard("#ffffff", { roughness: 1, map: mossTexture, normalMap: mossNormal });
const olive = standard("#6b7a3c", { roughness: 0.8 });
const kitchenWhite = standard("#f2f1ec", { roughness: 0.7 });
const kitchenGrey = standard("#85817b", { roughness: 0.8 });
const black = standard("#1f2126", { roughness: 0.7 });
const beige = standard("#cdbfa6");
const ceiling = noShadow(
  standard("#ffffff", {
    roughness: 1,
    map: ceilingTexture,
    emissive: "#8e8b84",
    emissiveMap: ceilingTexture,
    emissiveIntensity: 0.55,
  }),
);
const hardware = noShadow(standard("#1f2126", { roughness: 0.7 }));
const doorTrim = noShadow(standard("#3a4048"));
const panel = noShadow(standard("#fffaf0", { emissive: "#fff6e0", emissiveIntensity: 0.9 }));
const glassPane = noShadow(standard("#cfe6ee", { transparent: true, opacity: 0.28, depthWrite: false }));
const sky = standard("#9fd0ea", { emissive: "#9fd0ea", emissiveIntensity: 0.8 });
const deskTop = standard("#f1f1ee", { roughness: 0.6 });
const chairFabric = standard("#2f3844");

export class Office {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
  readonly controls: PointerLockControls;

  private tint: string;
  private structure = new THREE.Group();
  private sign: RoofSign | null = null;
  private desks: Desk[] = [];
  private deskCount = 0;
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

    this.deskCount = sessions.length;
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

    for (const at of planterSpots(sessions.length)) this.planter(b, at);

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

  // The attic hall: oak floor with a carpet walkway, a ceiling that slopes
  // down to both long walls, gabled end walls, and the roof's ducts and lights.
  private buildShell(b: StaticBuilder, size: { width: number; depth: number }) {
    const { width, depth } = size;
    const half = width / 2;
    b.box(oakFloor, [0, -0.06, 0], [width, 0.1, depth]);
    b.box(walkway, [0, -0.05, 0], [WALKWAY_HALF * 2, 0.1, depth]);

    const slope = Math.atan2(RIDGE - EAVE, half);
    const slopeLength = Math.hypot(half, RIDGE - EAVE) + 0.2;
    for (const side of [-1, 1]) {
      b.box(
        ceiling,
        [(side * half) / 2, (RIDGE + EAVE) / 2 + 0.06, 0],
        [slopeLength, 0.12, depth],
        [0, 0, -side * slope],
      );
    }

    // The walls take the user's own tint, the one the halls outside wear.
    const skin = noShadow(standard(this.tint));
    for (const side of [-1, 1]) b.box(skin, [side * half, EAVE / 2, 0], [WALL, EAVE, depth]);
    const gable = new THREE.Shape([
      new THREE.Vector2(-half, 0),
      new THREE.Vector2(half, 0),
      new THREE.Vector2(half, EAVE),
      new THREE.Vector2(0, RIDGE),
      new THREE.Vector2(-half, EAVE),
    ]);
    const gableGeometry = new THREE.ExtrudeGeometry(gable, { depth: WALL, bevelEnabled: false });
    for (const side of [-1, 1]) b.add(gableGeometry, skin, [0, 0, side * (depth / 2) - WALL / 2]);
    gableGeometry.dispose();

    // The way you came in, in the +z wall. It does not open: the way out is
    // the control on screen.
    for (const x of [-1.1, 1.1]) b.box(doorTrim, [x, 1.15, depth / 2 - WALL / 2], [0.16, 2.3, 0.12]);
    b.box(doorTrim, [0, 2.35, depth / 2 - WALL / 2], [2.4, 0.16, 0.12]);

    this.buildCeilingHardware(b, size);
    this.buildWindows(b, size);
    this.buildDoorEnd(b, size);
    this.buildMeetingRooms(b, size);
    this.buildSlatPartition(b);
    this.buildFarEnd(b);
  }

  // Ducts down the ridge, a track with spots on either side of it, and ring
  // lights hung on wires.
  private buildCeilingHardware(b: StaticBuilder, size: { width: number; depth: number }) {
    const { depth } = size;
    b.cylinder(hardware, [0, 4.6, 0], [0.36, depth - 2, 0.36], [Math.PI / 2, 0, 0]);
    for (let z = -depth / 2 + 4; z < depth / 2 - 2; z += 8) {
      b.cylinder(hardware, [0, 4.6, z], [0.3, 4, 0.3], [0, 0, Math.PI / 2]);
    }

    for (const x of [-2.6, 2.6]) {
      b.box(hardware, [x, 4.82, 0], [0.06, 0.06, depth - 2]);
      for (let z = -depth / 2 + 2; z < depth / 2 - 1; z += 2.5) {
        b.box(hardware, [x, 4.62, z], [0.12, 0.26, 0.12]);
      }
    }

    const ring = new THREE.TorusGeometry(1, 0.035, 8, 40);
    let index = 0;
    for (let z = -depth / 2 + 3.5; z < depth / 2 - 2; z += 7) {
      const x = index % 2 === 0 ? -5.4 : 5.4;
      const radius = 1.4;
      b.add(ring, panel, [x, 3.4, z], [radius, radius, radius], [Math.PI / 2, 0, 0]);
      for (const wire of [-1, 1]) {
        b.box(hardware, [x + wire * radius * 0.7, 3.9, z], [0.01, 1, 0.01]);
      }
      index++;
    }
    ring.dispose();
  }

  // Sky in a triangle at the far end and a half-round window in every
  // meeting room's wall, both sides.
  private buildWindows(b: StaticBuilder, size: { width: number; depth: number }) {
    const { width, depth } = size;
    const { triangleWindow } = zoneSpots(this.deskCount);
    const base = 1;
    const top = 3.6;
    const span = 1.8;
    const pane = new THREE.Shape([
      new THREE.Vector2(-span, 0),
      new THREE.Vector2(span, 0),
      new THREE.Vector2(0, top - base),
    ]);
    const paneGeometry = new THREE.ShapeGeometry(pane);
    const faceZ = -depth / 2 + WALL / 2 + 0.02;
    b.add(paneGeometry, sky, [triangleWindow.x, base, faceZ]);
    paneGeometry.dispose();
    const slant = Math.atan2(top - base, span);
    const slantLength = Math.hypot(span, top - base);
    b.box(black, [triangleWindow.x, base, faceZ + 0.02], [span * 2 + 0.12, 0.12, 0.06]);
    for (const side of [-1, 1]) {
      b.box(
        black,
        [triangleWindow.x + (side * span) / 2, (base + top) / 2, faceZ + 0.02],
        [slantLength, 0.1, 0.06],
        [0, 0, side * slant],
      );
    }
    b.box(black, [triangleWindow.x, (base + top) / 2 - 0.2, faceZ + 0.02], [0.08, top - base - 0.4, 0.06]);

    const radius = 1.7;
    const lift = 0.5;
    const disc = new THREE.CircleGeometry(radius, 24, 0, Math.PI);
    const rim = new THREE.RingGeometry(radius, radius + 0.12, 24, 1, 0, Math.PI);
    for (const side of [-1, 1]) {
      const x = side * (width / 2 - WALL / 2 - 0.02);
      const turn: [number, number, number] = [0, -side * (Math.PI / 2), 0];
      for (const z of sideWindowSpots(this.deskCount)) {
        b.add(disc, sky, [x, lift, z], [1, 1, 1], turn);
        b.add(rim, black, [x - side * 0.01, lift, z], [1, 1, 1], turn);
        b.box(black, [x, lift, z], [0.06, 0.12, radius * 2 + 0.24]);
      }
    }
    disc.dispose();
    rim.dispose();
  }

  // Beside the door: the moss wall with the user's name, a screen and an
  // olive door, and a glass meeting room on the other side of the walkway.
  private buildDoorEnd(b: StaticBuilder, size: { width: number; depth: number }) {
    const { depth } = size;
    const near = depth / 2 - 1;
    const far = depth / 2 - DOOR_ZONE;
    const length = near - far;
    const centre = (near + far) / 2;
    b.box(moss, [MOSS_X, GLASS_HEIGHT / 2, centre], [0.3, GLASS_HEIGHT, length]);
    this.room.blockers.push({ x: MOSS_X, z: centre, halfX: 0.2, halfZ: length / 2 });

    this.sign = new RoofSign(this.user, 5.5, true);
    this.sign.group.rotation.y = -Math.PI / 2;
    this.sign.group.position.set(MOSS_X - 0.2, 0.9, near - 2.7);
    this.structure.add(this.sign.group);

    b.box(black, [MOSS_X - 0.16, 1.4, far + 3], [0.05, 1.2, 0.75]);
    b.box(MATERIALS.glass, [MOSS_X - 0.19, 1.4, far + 3], [0.02, 1.1, 0.65]);
    b.box(olive, [MOSS_X - 0.17, 1.05, far + 1.4], [0.08, 2.1, 0.9]);
    b.box(black, [MOSS_X - 0.24, 1.05, far + 1.1], [0.08, 0.04, 0.14]);

    this.glassWall(b, -MOSS_X, centre, length, meetingDoorZ({ z: centre, length }));
    this.table(b, { x: -6.5, z: centre }, 1.2, 0.55, oak);
    for (const dz of [-0.6, 0.6]) {
      this.chair(b, { x: -5.6, z: centre + dz }, { x: -6.5, z: centre + dz }, chairFabric);
      this.chair(b, { x: -7.4, z: centre + dz }, { x: -6.5, z: centre + dz }, chairFabric);
    }
    this.meetingScreen(b, { x: -6.5, z: meetingScreenZ({ z: centre, length }) });
  }

  // Along the desk zone, behind glass with black frames, one room per bay.
  private buildMeetingRooms(b: StaticBuilder, size: { width: number; depth: number }) {
    const rooms = meetingRooms(this.deskCount);
    const middle = -(GLASS_X + size.width / 2 - WALL / 2) / 2;
    for (const [i, room] of rooms.entries()) {
      this.glassWall(b, -GLASS_X, room.z, room.length, meetingDoorZ(room));
      b.box(glassPane, [middle, GLASS_HEIGHT / 2, room.z + room.length / 2], [3.4, GLASS_HEIGHT, 0.05]);
      b.box(black, [middle, GLASS_HEIGHT / 2, room.z + room.length / 2], [3.4, 0.08, 0.08]);
      this.room.blockers.push({ x: middle, z: room.z + room.length / 2, halfX: 1.7, halfZ: 0.1 });
      if (i === rooms.length - 1) {
        b.box(glassPane, [middle, GLASS_HEIGHT / 2, room.z - room.length / 2], [3.4, GLASS_HEIGHT, 0.05]);
        this.room.blockers.push({ x: middle, z: room.z - room.length / 2, halfX: 1.7, halfZ: 0.1 });
      }
      this.table(b, { x: middle, z: room.z }, 1.3, 0.55, oak);
      for (const dz of [-0.6, 0.6]) {
        this.chair(b, { x: middle + 0.9, z: room.z + dz }, { x: middle, z: room.z + dz }, chairFabric);
        this.chair(b, { x: middle - 0.9, z: room.z + dz }, { x: middle, z: room.z + dz }, chairFabric);
      }
      this.meetingScreen(b, { x: middle, z: meetingScreenZ(room) });
    }
  }

  // Wooden posts and vertical slats with a diagonal brace in every bay, along
  // the desk zone on the side opposite the meeting rooms.
  private buildSlatPartition(b: StaticBuilder) {
    const { near, far } = deskZone(this.deskCount);
    const bays = Math.max(1, Math.round((near - far) / 3.5));
    const bay = (near - far) / bays;
    const height = GLASS_HEIGHT - 0.2;
    for (let i = 0; i <= bays; i++) b.box(oak, [GLASS_X, height / 2, near - bay * i], [0.3, height, 0.3]);
    for (let i = 0; i < bays; i++) {
      const centre = near - bay * (i + 0.5);
      for (let k = -Math.floor(bay / 0.3 / 2) + 1; k < bay / 0.3 / 2; k++) {
        b.box(oak, [GLASS_X, height / 2, centre + k * 0.3], [0.14, height - 0.3, 0.06]);
      }
      const slant = Math.atan2(height - 0.3, bay);
      for (const side of [-1, 1]) {
        b.box(
          oak,
          [GLASS_X + 0.1, height / 2, centre],
          [0.08, 0.08, Math.hypot(bay, height - 0.3)],
          [side * slant, 0, 0],
        );
      }
    }
    this.room.blockers.push({ x: GLASS_X, z: (near + far) / 2, halfX: 0.25, halfZ: (near - far) / 2 });
  }

  // The kitchen along the far wall, the round table under the triangle window
  // and the lunch island in the open floor.
  private buildFarEnd(b: StaticBuilder) {
    const zones = zoneSpots(this.deskCount);
    const { cabinets, island, bins, stools, roundTable, lunch, printer, whiteboard } = zones;

    this.buildKitchen(b, cabinets);
    b.box(kitchenGrey, [island.x, 0.47, island.z], [island.halfX * 2, 0.94, island.halfZ * 2]);
    b.box(oak, [island.x, 0.96, island.z], [island.halfX * 2 + 0.1, 0.05, island.halfZ * 2 + 0.1]);
    this.room.blockers.push({ x: island.x, z: island.z, halfX: island.halfX, halfZ: island.halfZ });
    for (const stool of stools) this.stool(b, stool);
    for (const bin of bins) {
      b.box(black, [bin.x, 0.45, bin.z], [0.55, 0.9, 0.5]);
      this.room.blockers.push({ x: bin.x, z: bin.z, halfX: 0.3, halfZ: 0.28 });
    }

    // Round table with four chairs, a plant in the middle.
    b.cylinder(black, [roundTable.x, 0.72, roundTable.z], [1.1, 0.05, 1.1]);
    b.cylinder(black, [roundTable.x, 0.36, roundTable.z], [0.08, 0.72, 0.08]);
    b.cylinder(black, [roundTable.x, 0.02, roundTable.z], [0.5, 0.04, 0.5]);
    b.cylinder(MATERIALS.concrete, [roundTable.x, 0.85, roundTable.z], [0.12, 0.2, 0.12]);
    addPlant(b, [roundTable.x, 0.95, roundTable.z], KINDS.rubber, 7, 0.5);
    this.room.blockers.push({ x: roundTable.x, z: roundTable.z, halfX: 1.1, halfZ: 1.1 });
    for (const angle of [0.78, 2.36, 3.93, 5.5]) {
      const at = { x: roundTable.x + Math.cos(angle) * 1.55, z: roundTable.z + Math.sin(angle) * 1.55 };
      this.chair(b, at, roundTable, black);
    }

    // A whiteboard beside the round table, and the printer by the walkway.
    addWhiteboard(b, [whiteboard.x, 0, whiteboard.z]);
    addPrinter(b, [printer.x, 0, printer.z]);
    this.room.blockers.push(whiteboard, printer);

    // The lunch island: two long tables side by side, chairs down the outer sides.
    for (const [i, z] of lunch.zs.entries()) {
      const side = i === 0 ? -1 : 1;
      this.table(b, { x: lunch.x, z }, lunch.halfZ, lunch.halfX, oak);
      for (const dx of [-2, -0.7, 0.7, 2]) {
        this.chair(b, { x: lunch.x + dx, z: z + side * 1.05 }, { x: lunch.x + dx, z }, beige);
      }
    }
  }

  // Fridge, pantry, a run of cabinets with a wood top, sink, hob and hood,
  // and wall cabinets, all in one row against the far wall.
  private buildKitchen(b: StaticBuilder, cabinets: { x: number; z: number; halfX: number; halfZ: number }) {
    const { z, halfZ } = cabinets;
    const front = z + halfZ;
    const left = cabinets.x - cabinets.halfX;
    const counterLeft = left + 3.5;
    const counterWidth = cabinets.halfX * 2 - 3.5;
    const counterMiddle = counterLeft + counterWidth / 2;

    b.box(MATERIALS.steel, [left + 0.55, 0.975, z], [0.95, 1.95, halfZ * 2]);
    b.box(black, [left + 0.55, 1.3, front + 0.005], [0.95, 0.02, 0.02]);
    for (const y of [1.0, 1.7]) b.box(black, [left + 0.9, y, front + 0.03], [0.03, 0.4, 0.03]);

    b.box(kitchenWhite, [left + 2.25, 1.15, z], [2.5, 2.3, halfZ * 2]);
    b.box(kitchenGrey, [left + 2.25, 1.15, front + 0.005], [0.02, 2.3, 0.02]);
    for (const dx of [-0.1, 0.1]) b.box(black, [left + 2.25 + dx, 1.1, front + 0.03], [0.03, 0.4, 0.03]);
    addMicrowave(b, [left + 1.6, 1.45, front]);

    b.box(kitchenWhite, [counterMiddle, 0.45, z], [counterWidth, 0.9, halfZ * 2]);
    b.box(oak, [counterMiddle, 0.93, z + 0.05], [counterWidth + 0.1, 0.05, halfZ * 2 + 0.1]);
    const doors = Math.round(counterWidth / 0.75);
    for (let i = 0; i < doors; i++) {
      const x = counterLeft + i * (counterWidth / doors);
      if (i > 0) b.box(kitchenGrey, [x, 0.45, front + 0.005], [0.02, 0.8, 0.02]);
      b.box(black, [x + 0.62, 0.78, front + 0.03], [0.03, 0.12, 0.03]);
    }

    const sink = counterLeft + 3;
    b.box(MATERIALS.steel, [sink, 0.96, z + 0.05], [0.8, 0.02, 0.5]);
    b.cylinder(MATERIALS.steel, [sink, 1.1, z - 0.2], [0.02, 0.3, 0.02]);
    b.box(MATERIALS.steel, [sink, 1.25, z - 0.08], [0.02, 0.02, 0.2]);
    // The dishwasher takes the first door clear of the sink basin, on the hob side.
    const doorWidth = counterWidth / doors;
    const dishwasherDoor = Math.ceil((sink + 0.4 - counterLeft) / doorWidth);
    addDishwasher(b, [counterLeft + (dishwasherDoor + 0.5) * doorWidth, 0, front], doorWidth);

    const counterTop = 0.955;
    addEspressoMachine(b, [counterLeft + 0.6, counterTop, z]);
    addKettle(b, [counterLeft + 1.3, counterTop, z]);
    addToaster(b, [counterLeft + 1.9, counterTop, z]);

    const hob = counterLeft + 5.5;
    b.box(black, [hob, 0.96, z + 0.05], [0.7, 0.02, 0.5]);
    for (const dx of [-0.17, 0.17]) {
      for (const dz of [-0.12, 0.12]) b.cylinder(kitchenGrey, [hob + dx, 0.975, z + 0.05 + dz], [0.09, 0.01, 0.09]);
    }
    b.box(MATERIALS.steel, [hob, 2.1, z - 0.05], [0.9, 0.25, 0.65]);

    b.box(kitchenGrey, [counterMiddle, 1.4, z - 0.23], [counterWidth, 0.9, 0.04]);
    const wallCabinet = (from: number, to: number) => {
      b.box(kitchenWhite, [(from + to) / 2, 1.95, z - 0.03], [to - from, 0.8, 0.4]);
      for (let x = from + 0.75; x < to - 0.1; x += 0.75) b.box(kitchenGrey, [x, 1.95, z + 0.18], [0.02, 0.8, 0.02]);
    };
    wallCabinet(counterLeft, hob - 0.55);
    wallCabinet(hob + 0.55, left + cabinets.halfX * 2 - 0.1);
    this.room.blockers.push({ x: cabinets.x, z, halfX: cabinets.halfX, halfZ });
  }

  private meetingScreen(b: StaticBuilder, at: { x: number; z: number }) {
    addMeetingScreen(b, [at.x, 0, at.z]);
    this.room.blockers.push({ x: at.x, z: at.z, halfX: 0.65, halfZ: 0.25 });
  }

  private stool(b: StaticBuilder, at: { x: number; z: number }) {
    b.cylinder(black, [at.x, 0.68, at.z], [0.2, 0.06, 0.2]);
    b.cylinder(MATERIALS.steel, [at.x, 0.33, at.z], [0.03, 0.66, 0.03]);
    b.cylinder(black, [at.x, 0.02, at.z], [0.18, 0.04, 0.18]);
    this.room.blockers.push({ x: at.x, z: at.z, halfX: 0.22, halfZ: 0.22 });
  }

  // A glass wall along z with black frames, and the blocker that goes with it.
  // With `doorZ`, a doorway opens there, its sliding door pushed open over the
  // pane on the -z side. The leaf is on the -x side, where every glass room is.
  private glassWall(b: StaticBuilder, x: number, z: number, length: number, doorZ?: number) {
    if (doorZ !== undefined) {
      const half = MEETING_DOOR_WIDTH / 2;
      const start = z - length / 2;
      const end = z + length / 2;
      this.glassWall(b, x, (start + doorZ - half) / 2, doorZ - half - start);
      this.glassWall(b, x, (doorZ + half + end) / 2, end - doorZ - half);
      b.box(black, [x, GLASS_HEIGHT, doorZ], [0.1, 0.08, MEETING_DOOR_WIDTH]);
      b.box(black, [x, DOOR_HEIGHT, doorZ], [0.1, 0.08, MEETING_DOOR_WIDTH]);
      b.box(
        glassPane,
        [x, (DOOR_HEIGHT + GLASS_HEIGHT) / 2, doorZ],
        [0.05, GLASS_HEIGHT - DOOR_HEIGHT, MEETING_DOOR_WIDTH],
      );

      const leaf = doorZ - MEETING_DOOR_WIDTH;
      b.box(glassPane, [x - 0.08, DOOR_HEIGHT / 2, leaf], [0.03, DOOR_HEIGHT - 0.04, MEETING_DOOR_WIDTH]);
      for (const edge of [-half, half]) {
        b.box(black, [x - 0.08, DOOR_HEIGHT / 2, leaf + edge], [0.05, DOOR_HEIGHT, 0.05]);
      }
      b.box(black, [x - 0.12, 1.05, leaf + half - 0.1], [0.03, 0.5, 0.03]); // handle
      return;
    }
    b.box(glassPane, [x, GLASS_HEIGHT / 2, z], [0.05, GLASS_HEIGHT, length]);
    b.box(black, [x, GLASS_HEIGHT, z], [0.1, 0.08, length]);
    b.box(black, [x, 0.04, z], [0.1, 0.08, length]);
    const bays = Math.max(1, Math.round(length / 1.6));
    for (let i = 0; i <= bays; i++) {
      b.box(black, [x, GLASS_HEIGHT / 2, z - length / 2 + (length / bays) * i], [0.1, GLASS_HEIGHT, 0.08]);
    }
    this.room.blockers.push({ x, z, halfX: 0.15, halfZ: length / 2 });
  }

  // A table on two leg panels at its short ends, `halfX` wide each way from
  // `at`, with its blocker.
  private table(b: StaticBuilder, at: { x: number; z: number }, halfZ: number, halfX: number, top: THREE.Material) {
    b.box(top, [at.x, 0.74, at.z], [halfX * 2, 0.07, halfZ * 2]);
    for (const side of [-1, 1]) {
      if (halfX >= halfZ) {
        b.box(MATERIALS.steel, [at.x + side * (halfX - 0.15), 0.37, at.z], [0.06, 0.74, halfZ * 2 - 0.2]);
      } else {
        b.box(MATERIALS.steel, [at.x, 0.37, at.z + side * (halfZ - 0.15)], [halfX * 2 - 0.2, 0.74, 0.06]);
      }
    }
    this.room.blockers.push({ x: at.x, z: at.z, halfX, halfZ });
  }

  // A chair at `at` with its back turned from `toward`, and its blocker.
  private chair(
    b: StaticBuilder,
    at: { x: number; z: number },
    toward: { x: number; z: number },
    fabric: THREE.Material,
  ) {
    const dx = toward.x - at.x;
    const dz = toward.z - at.z;
    const along = Math.hypot(dx, dz) || 1;
    b.box(fabric, [at.x, 0.45, at.z], [0.44, 0.07, 0.44]);
    const turn = Math.atan2(dx, dz);
    b.box(fabric, [at.x - (dx / along) * 0.22, 0.75, at.z - (dz / along) * 0.22], [0.44, 0.52, 0.07], [0, turn, 0]);
    for (const lx of [-0.16, 0.16]) {
      for (const lz of [-0.16, 0.16]) b.box(MATERIALS.steel, [at.x + lx, 0.22, at.z + lz], [0.05, 0.45, 0.05]);
    }
    this.room.blockers.push({ x: at.x, z: at.z, halfX: 0.3, halfZ: 0.3 });
  }

  // A wooden planter with plants, standing between two rows of desks.
  private planter(b: StaticBuilder, at: { x: number; z: number }) {
    b.box(oak, [at.x, 0.375, at.z], [1.6, 0.75, 0.5]);
    addSoil(b, [at.x, 0.76, at.z], [1.5, 0.04, 0.4]);
    const kinds = [KINDS.bushy, KINDS.rubber, KINDS.fern];
    const seed = Math.abs(Math.round(at.x * 7 + at.z * 13));
    for (const [i, dx] of [-0.5, 0, 0.5].entries()) {
      addPlant(b, [at.x + dx, 0.77, at.z], kinds[(seed + i) % 3], seed + i);
    }
    this.room.blockers.push({ x: at.x, z: at.z, halfX: 0.8, halfZ: 0.25 });
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
    addKeyboardAndMouse(b, [monitor, DESK_TOP + 0.03, z + 0.1]);

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
