// The little robots at the desks of an office floor. One per session, plus a
// smaller one per subagent beside its desk.
//
// A city worker (workers.ts) is seen from above across a whole park and is one
// instanced mesh for the lot. A robot is seen from a metre away while you walk
// past it, so it sits on its chair, its arms move, its head turns and its
// visor lights up. Its still parts are merged and cached per tint, so thirty
// robots on a floor still cost two geometries.

import * as THREE from "three";
import { standard } from "./palette.ts";
import { BAKED_MATERIAL, StaticBuilder } from "./static-builder.ts";

// Seated it is about 1.15 from the floor to the top of its head: a head and a
// pair of shoulders over a desk of 0.75.
export const ROBOT = { radius: 0.28, subagentScale: 0.66, seat: 0.42 };

const DARK = "#39414c";
// The shell is light metal and not the user's tint: a robot in the same tint
// as the room it stands in disappears into the wall behind it. The tint comes
// back on its head and as the band across its chest, so it still belongs to
// its user.
const SHELL = "#c9ced6";

const NECK_Y = 0.92; // the head turns and nods around this point
const SHOULDER_Y = 0.88;

// Shared by every robot: the visor is the only part that changes, so it is two
// materials that get swapped instead of one material per robot. The arm box
// hangs from its top, so turning it swings the hand and not the shoulder.
const VISOR_ON = standard("#9fe8ff", { emissive: "#7fd8ff", emissiveIntensity: 1.6 });
const VISOR_OFF = standard("#1c222a");
const ARM_GEOMETRY = new THREE.BoxGeometry(0.13, 0.38, 0.13).translate(0, -0.19, 0);
const ARM_MATERIAL = standard(SHELL);
const VISOR_GEOMETRY = new THREE.BoxGeometry(0.25, 0.09, 0.04);

// The still parts, merged once per tint. Vertex colours are baked into the
// geometry, so a tint needs its own; a floor only ever has one user's tint.
const bodyCache = new Map<string, THREE.BufferGeometry>();
const headCache = new Map<string, THREE.BufferGeometry>();

function cached(
  store: Map<string, THREE.BufferGeometry>,
  tint: string,
  build: (b: StaticBuilder, band: THREE.MeshStandardMaterial) => void,
): THREE.BufferGeometry {
  const hit = store.get(tint);
  if (hit) return hit;
  const b = new StaticBuilder();
  build(b, standard(tint));
  const geometry = (b.build().children[0] as THREE.Mesh).geometry;
  store.set(tint, geometry);
  return geometry;
}

// Everything below the neck, seated: thighs forward off the chair, shins down
// to the floor and a torso above the seat. It faces +z; the desk turns it.
function bodyGeometry(tint: string): THREE.BufferGeometry {
  return cached(bodyCache, tint, (b, band) => {
    const dark = standard(DARK);
    const shell = standard(SHELL);
    const seat = ROBOT.seat;
    for (const x of [-0.12, 0.12]) {
      b.box(dark, [x, seat + 0.02, 0.15], [0.15, 0.13, 0.42]); // thigh, forward off the seat
      b.box(dark, [x, seat / 2 - 0.02, 0.33], [0.13, seat - 0.04, 0.13]); // shin
      b.box(dark, [x, 0.03, 0.4], [0.15, 0.06, 0.24]); // foot
    }
    b.box(shell, [0, seat + 0.14, 0], [0.44, 0.22, 0.34]); // hips, on the seat
    b.box(shell, [0, seat + 0.4, 0], [0.5, 0.34, 0.38]); // chest
    b.box(band, [0, seat + 0.46, 0.01], [0.52, 0.13, 0.4]); // the user's tint across the chest
    b.box(dark, [0, seat + 0.58, 0], [0.4, 0.05, 0.32]); // collar
  });
}

// Everything above the neck, built around the neck so the group can turn.
function headGeometry(tint: string): THREE.BufferGeometry {
  return cached(headCache, tint, (b, band) => {
    const dark = standard(DARK);
    b.cylinder(dark, [0, 0.02, 0], [0.06, 0.06, 0.06]); // neck
    // The head wears the user's tint. Over a desk it is the part you actually
    // see, so it is what tells you whose office you are standing in.
    b.box(band, [0, 0.14, 0], [0.34, 0.28, 0.3]);
    b.box(dark, [0, 0.29, 0], [0.36, 0.05, 0.32]); // cap, so the head is not one block
    b.box(dark, [0, 0.02, 0.15], [0.24, 0.07, 0.04]); // chin plate
    for (const x of [-0.1, 0.1]) b.cylinder(dark, [x, 0.37, 0], [0.025, 0.1, 0.025]); // antennae
  });
}

export class Robot {
  readonly group = new THREE.Group();

  private arms: THREE.Mesh[] = [];
  private visor: THREE.Mesh;
  private head = new THREE.Group();
  private torso = new THREE.Group();
  private busy = false;
  private phase: number;

  /**
   * `tint` is the user's wall tint, so a robot belongs to the same family as
   * the halls outside. `phase` keeps two busy robots out of step.
   */
  constructor(tint: string, phase: number, scale = 1) {
    this.phase = phase;

    const body = new THREE.Mesh(bodyGeometry(tint), BAKED_MATERIAL);
    const head = new THREE.Mesh(headGeometry(tint), BAKED_MATERIAL);
    this.visor = new THREE.Mesh(VISOR_GEOMETRY, VISOR_OFF);
    this.visor.position.set(0, 0.14, 0.16);
    this.head.position.y = NECK_Y;
    this.head.add(head, this.visor);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(ARM_GEOMETRY, ARM_MATERIAL);
      arm.position.set(side * 0.29, SHOULDER_Y, 0.06);
      arm.rotation.x = -1.05; // hands on the desk
      this.arms.push(arm);
      this.torso.add(arm);
    }

    // Every geometry here comes from a cache the other robots draw from, so
    // the office's dispose walk has to leave all of it alone.
    for (const mesh of [body, head, this.visor, ...this.arms]) {
      mesh.castShadow = true;
      mesh.userData.sharedGeometry = true;
    }
    body.receiveShadow = true;

    this.torso.add(body, this.head);
    this.group.add(this.torso);
    this.group.scale.setScalar(scale);
  }

  setBusy(busy: boolean) {
    if (busy === this.busy) return;
    this.busy = busy;
    this.visor.material = busy ? VISOR_ON : VISOR_OFF;
  }

  // Typing: the arms take turns on the desk, the head nods along and the upper
  // body leans into the work. An idle robot sits back, looks slowly around the
  // room and breathes.
  tick(now: number) {
    const t = now / 1000 + this.phase;
    if (this.busy) {
      for (const [i, arm] of this.arms.entries()) {
        arm.rotation.x = -1.05 + Math.sin(t * 9 + i * Math.PI) * 0.18;
      }
      this.head.rotation.x = 0.12 + Math.sin(t * 2.2) * 0.06;
      this.head.rotation.y = Math.sin(t * 0.7) * 0.12;
      this.torso.rotation.x = 0.06 + Math.sin(t * 1.1) * 0.02;
      this.torso.position.y = 0;
      return;
    }
    for (const [i, arm] of this.arms.entries()) {
      arm.rotation.x = -0.5 + Math.sin(t * 0.6 + i) * 0.04; // hands in its lap
    }
    this.head.rotation.x = Math.sin(t * 0.5) * 0.05;
    this.head.rotation.y = Math.sin(t * 0.35) * 0.45; // looking around the room
    this.torso.rotation.x = 0;
    this.torso.position.y = Math.sin(t * 0.9) * 0.012; // breathing
  }
}
