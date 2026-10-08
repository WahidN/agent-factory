// Fireworks for a milestone and confetti for kudos, over the user's HQ.
//
// A fixed pool of SHOW_SLOTS shows, each one InstancedMesh with its capacity
// allocated up front, so a show costs one draw call and ticking allocates
// nothing. A slot that is not playing is hidden and costs none. The particle
// motion is a pure function of (kind, index, time) so it needs no WebGL to test.

import * as THREE from "three";
import type { CityEvent, CityEventSink } from "./city-feed.ts";

export type LocateHq = (user: string) => { x: number; z: number; top: number; tint: THREE.Color } | null;

export type ShowKind = "fireworks" | "confetti";
export type Particle = { x: number; y: number; z: number; scale: number };

export const SHOW_SLOTS = 3;
const BURSTS = 3;
const BURST_GAP = 0.9;
const GRAVITY = 3;
const CONFETTI_SPREAD = 0.6;

// Per kind: particle count, seconds a particle lives, and the show length.
export const SHOWS = {
  fireworks: { count: 120, life: 3.2, duration: (BURSTS - 1) * BURST_GAP + 3.2 },
  confetti: { count: 60, life: 2.4, duration: CONFETTI_SPREAD + 2.4 },
} as const;
const CAPACITY = Math.max(SHOWS.fireworks.count, SHOWS.confetti.count);

const GOLD = new THREE.Color("#ffd24a");
const WHITE = new THREE.Color("#ffffff");
const CONFETTI = ["#e8503a", "#f2b632", "#3a9bd9", "#4cb782", "#c264d6"].map((c) => new THREE.Color(c));

// Deterministic 0..1 noise per (index, channel).
function rand(i: number, channel: number): number {
  const s = Math.sin(i * 12.9898 + channel * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Where particle `i` of a show is `t` seconds after it started, relative to the
 * HQ top. Writes into `out` and returns false while the particle is not alive.
 */
export function particleAt(kind: ShowKind, i: number, t: number, out: Particle): boolean {
  const { life } = SHOWS[kind];
  if (kind === "fireworks") {
    const burst = i % BURSTS;
    const age = t - burst * BURST_GAP;
    if (age < 0 || age > life) return false;
    // The burst blooms well above the top, off to one side. Sized for the
    // overview camera, where one world unit is only a few pixels.
    const cx = (rand(burst, 1) - 0.5) * 20;
    const cz = (rand(burst, 2) - 0.5) * 20;
    const cy = 20 + rand(burst, 3) * 8;
    // Uniform direction on a sphere, then a speed.
    const cosTheta = rand(i, 1) * 2 - 1;
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    const phi = rand(i, 2) * Math.PI * 2;
    const speed = 8 + rand(i, 3) * 6;
    out.x = cx + sinTheta * Math.cos(phi) * speed * age;
    out.z = cz + sinTheta * Math.sin(phi) * speed * age;
    out.y = cy + cosTheta * speed * age - 0.5 * GRAVITY * age * age;
    out.scale = 4 * (1 - age / life);
    return true;
  }
  const age = t - rand(i, 4) * CONFETTI_SPREAD;
  if (age < 0 || age > life) return false;
  const phase = rand(i, 5) * Math.PI * 2;
  out.x = (rand(i, 1) - 0.5) * 30 + Math.sin(age * 3 + phase) * 3;
  out.z = (rand(i, 2) - 0.5) * 30 + Math.cos(age * 2.4 + phase) * 3;
  out.y = 20 + rand(i, 3) * 8 - age * 7;
  out.scale = 3.5 * Math.min(1, (life - age) / 0.5);
  return true;
}

type Show = {
  mesh: THREE.InstancedMesh;
  active: boolean;
  kind: ShowKind;
  age: number;
};

export class Ceremony implements CityEventSink {
  readonly group = new THREE.Group();

  private readonly geometry = new THREE.OctahedronGeometry(1);
  private readonly material = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  private readonly shows: Show[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly particle: Particle = { x: 0, y: 0, z: 0, scale: 0 };
  private readonly color = new THREE.Color();

  constructor(private readonly locate: LocateHq) {
    for (let i = 0; i < SHOW_SLOTS; i++) {
      const mesh = new THREE.InstancedMesh(this.geometry, this.material, CAPACITY);
      // Creates the colour buffer now, so the first show allocates nothing.
      mesh.setColorAt(0, this.color.set("#ffffff"));
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.visible = false;
      this.group.add(mesh);
      this.shows.push({ mesh, active: false, kind: "fireworks", age: 0 });
    }
    this.group.visible = false;
  }

  push(event: CityEvent): void {
    if (event.kind !== "milestone" && event.kind !== "kudos") return;
    const hq = this.locate(event.user);
    if (!hq) return;
    const kind: ShowKind = event.kind === "milestone" ? "fireworks" : "confetti";
    const show = this.freeSlot();
    show.active = true;
    show.kind = kind;
    show.age = 0;
    show.mesh.count = SHOWS[kind].count;
    show.mesh.position.set(hq.x, hq.top, hq.z);
    for (let i = 0; i < show.mesh.count; i++) {
      this.paint(kind, i, hq.tint);
      show.mesh.setColorAt(i, this.color);
    }
    if (show.mesh.instanceColor) show.mesh.instanceColor.needsUpdate = true;
    this.draw(show);
    show.mesh.visible = true;
    this.group.visible = true;
  }

  tick(dt: number): void {
    let any = false;
    for (const show of this.shows) {
      if (!show.active) continue;
      show.age += dt;
      if (show.age >= SHOWS[show.kind].duration) {
        show.active = false;
        show.mesh.visible = false;
        continue;
      }
      this.draw(show);
      any = true;
    }
    this.group.visible = any;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    for (const show of this.shows) show.mesh.dispose();
  }

  // A free slot, or the one that has been playing longest.
  private freeSlot(): Show {
    let oldest = this.shows[0];
    for (const show of this.shows) {
      if (!show.active) return show;
      if (show.age > oldest.age) oldest = show;
    }
    return oldest;
  }

  // Sets this.color. Each firework burst takes one colour: the HQ tint, white or gold.
  private paint(kind: ShowKind, i: number, tint: THREE.Color) {
    if (kind === "confetti") this.color.copy(CONFETTI[i % CONFETTI.length]);
    else this.color.copy([tint, WHITE, GOLD][i % BURSTS]);
  }

  private draw(show: Show) {
    const p = this.particle;
    for (let i = 0; i < show.mesh.count; i++) {
      if (particleAt(show.kind, i, show.age, p))
        this.matrix.makeScale(p.scale, p.scale, p.scale).setPosition(p.x, p.y, p.z);
      else this.matrix.makeScale(0, 0, 0);
      show.mesh.setMatrixAt(i, this.matrix);
    }
    show.mesh.instanceMatrix.needsUpdate = true;
  }
}
