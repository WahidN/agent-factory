// Your own hands, held at the bottom of the view while you walk the office.
// They hang off the camera instead of standing in the room, so they are the
// one thing that never moves relative to what you are looking at.
//
// They are ordinary human hands: skin, five fingers, and a sleeve in the tint
// of whoever's floor you are on.

import * as THREE from "three";
import { standard } from "./palette.ts";
import { StaticBuilder } from "./static-builder.ts";
import { BAKED_MATERIAL } from "./static-builder.ts";

// Where a hand hangs in front of the eyes. This close to the camera a hand
// covers a quarter of the screen for every few centimetres it comes nearer,
// so it sits low and wide, with the hand itself the far end.
const AT = { forward: -0.66, side: 0.4, drop: -0.46, scale: 0.5 };
const STEP_LENGTH = 1.6; // metres per full swing of the arms

const SKIN = "#d8a879";
const FINGERS = [
  { x: -0.0375, length: 0.1 }, // pinky
  { x: -0.0125, length: 0.12 }, // ring
  { x: 0.0125, length: 0.13 }, // middle
  { x: 0.0375, length: 0.115 }, // index
];
const CURL = 0.35;

// Built along -z, which is where the camera looks: the forearm starts near
// your eyes and the hand is the end furthest away.
function handGeometry(tint: string): THREE.BufferGeometry {
  const b = new StaticBuilder();
  const skin = standard(SKIN, { roughness: 0.9 });
  const sleeve = standard(tint);
  const lengthwise: [number, number, number] = [Math.PI / 2, 0, 0];
  b.cylinder(sleeve, [0, 0, 0.12], [0.06, 0.32, 0.06], lengthwise); // sleeve, running back toward you
  b.cylinder(sleeve, [0, 0, -0.04], [0.066, 0.05, 0.066], lengthwise); // cuff
  b.cylinder(skin, [0, 0, -0.085], [0.045, 0.06, 0.045], lengthwise); // wrist
  b.box(skin, [0, 0, -0.18], [0.11, 0.035, 0.14]); // palm
  for (const { x, length } of FINGERS) {
    const near = length * 0.55;
    const far = length - near;
    b.cylinder(skin, [x, 0.003, -0.25 - near / 2], [0.0125, near, 0.0125], lengthwise);
    const tip = [x, 0.003 - Math.sin(CURL) * far * 0.5, -0.25 - near - Math.cos(CURL) * far * 0.5] as const;
    b.cylinder(skin, [...tip], [0.0115, far, 0.0115], [Math.PI / 2 - CURL, 0, 0]);
  }
  b.box(skin, [0.07, -0.015, -0.175], [0.032, 0.03, 0.08], [0, -0.5, 0]); // thumb base
  b.box(skin, [0.095, -0.015, -0.225], [0.026, 0.026, 0.06], [0, -0.35, 0]); // thumb tip
  return (b.build().children[0] as THREE.Mesh).geometry;
}

export class Hands {
  readonly group = new THREE.Group();

  private hands: THREE.Group[] = [];
  private geometry: THREE.BufferGeometry;
  // How far you have walked, in metres. The swing follows the distance and
  // not the clock, so the hands stop dead when you do.
  private walked = 0;

  constructor(tint: string) {
    this.geometry = handGeometry(tint);
    for (const side of [-1, 1]) {
      const hand = new THREE.Group();
      const mesh = new THREE.Mesh(this.geometry, BAKED_MATERIAL);
      // Shadows off: they hang in front of the camera, where a shadow would
      // land on whatever you happen to be looking at.
      mesh.castShadow = false;
      hand.add(mesh);
      hand.position.set(side * AT.side, AT.drop, AT.forward);
      // Raised a little at the far end and turned inward, the way your own
      // hands hang when you walk with them in front of you.
      hand.rotation.set(0.22, side * 0.3, side * -0.12);
      // One geometry, mirrored, so both thumbs face inward.
      hand.scale.set(side * AT.scale, AT.scale, AT.scale);
      this.hands.push(hand);
      this.group.add(hand);
    }
  }

  // `distance` is how far you moved this frame.
  tick(distance: number, now: number) {
    this.walked += distance;
    const swing = (this.walked / STEP_LENGTH) * Math.PI * 2;
    const breathe = Math.sin(now / 1000) * 0.006;
    for (const [i, hand] of this.hands.entries()) {
      const side = i === 0 ? -1 : 1;
      const phase = swing + i * Math.PI;
      hand.position.y = AT.drop + Math.sin(phase * 2) * 0.014 + breathe;
      hand.position.z = AT.forward + Math.sin(phase) * 0.03;
      hand.rotation.x = 0.22 + Math.sin(phase) * 0.12;
      hand.rotation.z = side * -0.12 + Math.sin(phase) * 0.03;
    }
  }

  dispose() {
    this.geometry.dispose();
  }
}
