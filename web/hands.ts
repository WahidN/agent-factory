// Your own hands, held at the bottom of the view while you walk the office.
// They hang off the camera instead of standing in the room, so they are the
// one thing that never moves relative to what you are looking at.
//
// You are a robot like the ones at the desks: the same metal shell, with a
// cuff in the tint of whoever's floor you are on.

import * as THREE from "three";
import { standard } from "./palette.ts";
import { StaticBuilder } from "./static-builder.ts";
import { BAKED_MATERIAL } from "./static-builder.ts";

// Where a hand hangs in front of the eyes. This close to the camera a hand
// covers a quarter of the screen for every few centimetres it comes nearer,
// so it sits low and wide, with the hand itself the far end.
const AT = { forward: -0.66, side: 0.4, drop: -0.46, scale: 0.5 };
const STEP_LENGTH = 1.6; // metres per full swing of the arms

// Built along -z, which is where the camera looks: the forearm starts near
// your eyes and the hand is the end furthest away.
function handGeometry(tint: string): THREE.BufferGeometry {
  const b = new StaticBuilder();
  const shell = standard("#c9ced6");
  const dark = standard("#39414c");
  const band = standard(tint);
  b.box(shell, [0, 0, 0.12], [0.1, 0.1, 0.32]); // forearm, running back toward you
  b.box(band, [0, 0, -0.05], [0.11, 0.11, 0.05]); // cuff in the user's tint
  b.box(dark, [0, 0, -0.1], [0.1, 0.08, 0.05]); // wrist joint
  b.box(shell, [0, 0, -0.2], [0.12, 0.08, 0.16]); // palm
  for (const x of [-0.035, 0.035]) b.box(shell, [x, 0.005, -0.31], [0.045, 0.06, 0.1]); // two fingers
  b.box(shell, [0.07, -0.02, -0.18], [0.05, 0.05, 0.1], [0, 0.35, 0]); // thumb
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
