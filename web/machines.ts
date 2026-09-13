// Animated machines for lots and warehouses. Non-moving parts go into the lot's
// StaticBuilder; only moving or glowing parts are separate meshes.
// Every machine takes its origin in lot coordinates and exposes `group` and `tick`.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { COLORS, MATERIALS, TEXTURES, standard } from "./palette.ts";
import { forkliftPose } from "./park-layout.ts";
import { StaticBuilder, type Vec3 } from "./static-builder.ts";

export const YARD_Y = 0.2;

const UP = new THREE.Vector3(0, 1, 0);
const tmpQuaternion = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpMatrix = new THREE.Matrix4();
const tmpPosition = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

// A thin box from point a to point b, for lattice and frame braces.
export function beam(builder: StaticBuilder, material: THREE.Material, a: Vec3, b: Vec3, thickness: number) {
  const start = new THREE.Vector3(...a);
  const direction = new THREE.Vector3(...b).sub(start);
  const length = direction.length();
  const mid = start.addScaledVector(direction, 0.5);
  tmpQuaternion.setFromUnitVectors(UP, direction.normalize());
  tmpEuler.setFromQuaternion(tmpQuaternion);
  builder.box(material, [mid.x, mid.y, mid.z], [thickness, length, thickness], [tmpEuler.x, tmpEuler.y, tmpEuler.z]);
}

// ---------- Smoke and steam ----------

const puffGeometry = new THREE.IcosahedronGeometry(0.5, 1);

type Puff = { alive: boolean; age: number; life: number; x: number; y: number; z: number; rise: number; size: number; drift: number };

// A fixed pool of puffs drawn as one instanced mesh.
export class Smoke {
  readonly mesh: THREE.InstancedMesh;
  private puffs: Puff[];

  constructor(count: number, material: THREE.Material) {
    this.mesh = new THREE.InstancedMesh(puffGeometry, material, count);
    this.mesh.frustumCulled = false; // instances move far from the mesh origin
    this.puffs = Array.from({ length: count }, () => ({ alive: false, age: 0, life: 1, x: 0, y: 0, z: 0, rise: 1, size: 1, drift: 0 }));
    for (let i = 0; i < count; i++) this.mesh.setMatrixAt(i, tmpMatrix.makeScale(0, 0, 0));
  }

  emit([x, y, z]: Vec3, life: number, rise: number, size: number, spread = 0.2) {
    const puff = this.puffs.find((p) => !p.alive);
    if (!puff) return;
    Object.assign(puff, {
      alive: true,
      age: 0,
      life,
      x: x + (Math.random() - 0.5) * spread,
      y,
      z: z + (Math.random() - 0.5) * spread,
      rise,
      size,
      drift: 0.3 + Math.random() * 0.4,
    });
  }

  tick(dt: number) {
    this.puffs.forEach((puff, i) => {
      if (!puff.alive) return;
      puff.age += dt;
      const k = puff.age / puff.life;
      if (k >= 1) {
        puff.alive = false;
        this.mesh.setMatrixAt(i, tmpMatrix.makeScale(0, 0, 0));
        return;
      }
      puff.y += puff.rise * (1 - k * 0.6) * dt;
      puff.x += puff.drift * (0.5 + k) * dt; // light wind
      const swell = k < 0.15 ? k / 0.15 : 1 - Math.pow((k - 0.15) / 0.85, 2);
      const scale = puff.size * (0.6 + k * 1.4) * swell;
      tmpQuaternion.setFromEuler(tmpEuler.set(i, i * 0.7, 0));
      this.mesh.setMatrixAt(i, tmpMatrix.compose(tmpPosition.set(puff.x, puff.y, puff.z), tmpQuaternion, tmpScale.setScalar(scale)));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Emits puffs at a rate that eases between a slow and a fast interval.
class Emitter {
  private wait = Math.random();
  tick(dt: number, interval: number, emit: () => void) {
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = interval * (0.8 + Math.random() * 0.4);
    emit();
  }
}

// ---------- Chimney stacks ----------

export type StacksOptions = { count: number; height: number; radius: number; frame: boolean };

export class Stacks {
  readonly group = new THREE.Group();
  private rimMaterial = standard(COLORS.rim, { emissive: "#ff6a1a", emissiveIntensity: 0 });
  private smoke: Smoke;
  private emitters: Emitter[] = [];
  private tops: Vec3[] = [];

  constructor(builder: StaticBuilder, [ox, oz]: [number, number], private options: StacksOptions) {
    const { count, height, radius, frame } = options;
    const spacing = radius * 2.5;
    this.smoke = new Smoke(count * 14, MATERIALS.smoke);
    this.group.add(this.smoke.mesh);

    if (frame) {
      const half = spacing * (count / 2) + radius * 0.5;
      const levels = [height * 0.3, height * 0.55];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) builder.box(MATERIALS.steel, [ox + sx * half, YARD_Y + levels[1] / 2, oz + sz * half], [0.3, levels[1], 0.3]);
      }
      for (const y of levels) {
        for (const s of [-1, 1]) {
          builder.box(MATERIALS.steel, [ox, YARD_Y + y, oz + s * half], [half * 2, 0.25, 0.25]);
          builder.box(MATERIALS.steel, [ox + s * half, YARD_Y + y, oz], [0.25, 0.25, half * 2]);
        }
        builder.box(MATERIALS.darkSteel, [ox, YARD_Y + y + 0.15, oz], [half * 2, 0.08, half * 2]); // grate
      }
      // X braces on the two visible faces
      for (const [a, b] of [
        [[-half, 0, half], [half, levels[0], half]],
        [[half, 0, half], [-half, levels[0], half]],
        [[half, 0, -half], [half, levels[0], half]],
        [[half, 0, half], [half, levels[0], -half]],
      ] as [Vec3, Vec3][]) {
        beam(builder, MATERIALS.steel, [ox + a[0], YARD_Y + a[1], oz + a[2]], [ox + b[0], YARD_Y + b[1], oz + b[2]], 0.16);
      }
    }

    const rims: THREE.BufferGeometry[] = [];
    for (let i = 0; i < count; i++) {
      const x = ox + (i - (count - 1) / 2) * spacing;
      builder.cylinder(MATERIALS.concrete, [x, YARD_Y + height / 2, oz], [radius, height, radius]);
      builder.cylinder(MATERIALS.darkSteel, [x, YARD_Y + height + 0.02, oz], [radius * 0.78, 0.1, radius * 0.78]);
      rims.push(new THREE.CylinderGeometry(radius * 1.08, radius * 1.08, radius * 1.3, 20, 1, true).translate(x, YARD_Y + height - radius * 0.6, oz));
      this.tops.push([x, YARD_Y + height + 0.3, oz]);
      this.emitters.push(new Emitter());
    }
    // All rims share one glowing material, so they can be one mesh.
    const rim = new THREE.Mesh(mergeGeometries(rims), this.rimMaterial);
    rims.forEach((g) => g.dispose());
    rim.castShadow = true;
    this.group.add(rim);
  }

  // busy: thin slow smoke. active: glowing rims, fast thick smoke.
  tick(dt: number, busy: number, active: number) {
    this.rimMaterial.emissiveIntensity = active * 1.6;
    const { radius } = this.options;
    if (busy > 0.05) {
      this.emitters.forEach((emitter, i) =>
        emitter.tick(dt, THREE.MathUtils.lerp(1.3, 0.14, active), () =>
          this.smoke.emit(this.tops[i], 3.4 - active, 1 + active * 2.2, radius * (1.3 + active * 1.6), radius),
        ),
      );
    }
    this.smoke.tick(dt);
  }

  dispose() {
    this.rimMaterial.dispose();
    this.smoke.mesh.dispose();
  }
}

// ---------- Forklift ----------

// A small moving part built from merged pieces.
export function mergedGroup(build: (b: StaticBuilder) => void) {
  const builder = new StaticBuilder();
  build(builder);
  return builder.build();
}

export const CARGO_MATERIAL = standard("#3f9e8f");

export class Forklift {
  readonly group = new THREE.Group();
  private carriage: THREE.Group;
  private load: THREE.Group;
  private phase = 0;

  // Drives along z at x = ox, between `from` (dock) and `to` (truck). Forks point +z.
  constructor(builder: StaticBuilder, ox: number, private from: number, private to: number) {
    this.group.position.set(ox, YARD_Y, from);

    this.group.add(
      mergedGroup((b) => {
        b.box(MATERIALS.yellow, [0, 0.55, 0], [1.2, 0.6, 1.9]);
        b.box(MATERIALS.darkSteel, [0, 0.75, -0.95], [1.25, 0.8, 0.35]); // counterweight
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) b.cylinder(MATERIALS.tire, [sx * 0.62, 0.3, sz * 0.6], [0.3, 0.22, 0.3], [0, 0, Math.PI / 2]);
          b.box(MATERIALS.darkSteel, [sx * 0.52, 1.5, -0.55], [0.07, 1.3, 0.07]); // cabin posts
          b.box(MATERIALS.darkSteel, [sx * 0.52, 1.5, 0.45], [0.07, 1.3, 0.07]);
          b.box(MATERIALS.darkSteel, [sx * 0.35, 1.4, 1.08], [0.12, 2.4, 0.12]); // mast rails
        }
        b.box(MATERIALS.yellow, [0, 2.18, -0.05], [1.15, 0.08, 1.15]); // roof
        b.box(MATERIALS.darkSteel, [0, 1.0, -0.2], [0.55, 0.35, 0.5]); // seat
      }),
    );

    this.carriage = mergedGroup((b) => {
      b.box(MATERIALS.darkSteel, [0, 0.35, 1.2], [0.9, 0.7, 0.08]);
      for (const sx of [-1, 1]) b.box(MATERIALS.darkSteel, [sx * 0.28, 0.02, 1.75], [0.14, 0.06, 1.1]);
    });
    this.load = mergedGroup((b) => {
      b.box(MATERIALS.wood, [0, 0.12, 1.75], [1.15, 0.14, 1.15]);
      b.box(CARGO_MATERIAL, [0, 0.62, 1.75], [1.05, 0.85, 1.05]);
    });
    this.carriage.add(this.load);
    this.group.add(this.carriage);

    // Pallet stacks waiting by the dock
    for (const [px, pz, h] of [
      [-2.8, -0.6, 2],
      [-2.8, 0.9, 1],
      [2.6, -0.8, 2],
    ]) {
      for (let level = 0; level < h; level++) {
        const y = YARD_Y + level * 1.0;
        builder.box(MATERIALS.wood, [ox + px, y + 0.08, from + pz], [1.15, 0.16, 1.15]);
        builder.box(CARGO_MATERIAL, [ox + px, y + 0.6, from + pz], [1.05, 0.85, 1.05]);
      }
    }
  }

  tick(dt: number, active: number) {
    this.phase += dt * 0.32 * active; // stops in place when inactive
    const pose = forkliftPose(this.phase, this.from, this.to);
    this.group.position.z = pose.z;
    this.carriage.position.y = 0.2 + pose.fork * 1.1;
    this.load.visible = pose.carrying;
  }
}

// ---------- Searchlight ----------

export type SearchlightOptions = { tower: boolean; height: number; reach: number; aimAt: [number, number] };

export class Searchlight {
  readonly group = new THREE.Group();
  private yaw = new THREE.Group();
  private lensMaterial = standard("#fff4d6", { emissive: "#fff1c9", emissiveIntensity: 0 });
  private beamMaterial = new THREE.MeshBasicMaterial({
    color: "#fff3cf",
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private poolMaterial = new THREE.MeshBasicMaterial({
    map: TEXTURES.lightPool,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private pool: THREE.Mesh;
  private baseYaw: number;
  private time = 0;

  constructor(builder: StaticBuilder, [ox, oz]: [number, number], private options: SearchlightOptions) {
    const { tower, height, reach, aimAt } = options;
    this.baseYaw = Math.atan2(-(aimAt[0] - ox), -(aimAt[1] - oz));

    if (tower) {
      const bottom = 1.3;
      const top = 0.55;
      const corners = (h: number, s: number) =>
        [
          [-s, h, -s],
          [s, h, -s],
          [s, h, s],
          [-s, h, s],
        ] as Vec3[];
      const levels = [0, height * 0.33, height * 0.66, height];
      const size = (h: number) => bottom + (top - bottom) * (h / height);
      const at = ([x, y, z]: Vec3): Vec3 => [ox + x, YARD_Y + y, oz + z];
      const low = corners(0, bottom);
      const high = corners(height, top);
      for (let i = 0; i < 4; i++) beam(builder, MATERIALS.steel, at(low[i]), at(high[i]), 0.16);
      for (let l = 0; l < levels.length - 1; l++) {
        const a = corners(levels[l], size(levels[l]));
        const b = corners(levels[l + 1], size(levels[l + 1]));
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          beam(builder, MATERIALS.steel, at(a[i]), at(b[j]), 0.08);
          beam(builder, MATERIALS.steel, at(a[j]), at(b[i]), 0.08);
          beam(builder, MATERIALS.steel, at(b[i]), at(b[j]), 0.1);
        }
      }
      builder.box(MATERIALS.darkSteel, [ox, YARD_Y + height + 0.05, oz], [top * 2 + 0.8, 0.12, top * 2 + 0.8]);
    } else {
      builder.cylinder(MATERIALS.darkSteel, [ox, YARD_Y + height / 2, oz], [0.06, height, 0.06]);
    }

    // Moving head: yaw sweeps, pitch aims the beam down toward the yard.
    this.group.position.set(ox, YARD_Y + height + (tower ? 0.5 : 0.1), oz);
    this.group.add(this.yaw);
    const pitch = new THREE.Group();
    pitch.rotation.x = Math.atan2(reach, height); // tilts the downward beam outward
    this.yaw.add(pitch);

    const scale = tower ? 1 : 0.45;
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * scale, 0.6 * scale, 0.9 * scale, 14), MATERIALS.darkSteel);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.55 * scale, 14), this.lensMaterial);
    lens.rotation.x = Math.PI / 2;
    lens.position.y = -0.46 * scale;
    housing.castShadow = true;
    pitch.add(housing, lens);

    const length = Math.hypot(height, reach);
    const beamGeometry = new THREE.ConeGeometry(tower ? 2.6 : 1.1, length, 24, 1, true);
    beamGeometry.translate(0, -length / 2, 0); // apex at the lamp
    const beamMesh = new THREE.Mesh(beamGeometry, this.beamMaterial);
    pitch.add(beamMesh);

    const poolSize = tower ? 7 : 3;
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(poolSize, poolSize), this.poolMaterial);
    this.pool.rotation.x = -Math.PI / 2;
    this.group.add(this.pool);
  }

  tick(dt: number, active: number) {
    this.time += dt * active;
    const yaw = this.baseYaw + Math.sin(this.time * 1.3) * 0.8;
    this.yaw.rotation.y = yaw;
    const { reach, height, tower } = this.options;
    this.pool.position.set(-Math.sin(yaw) * reach, -(height + (tower ? 0.5 : 0.1)) + 0.02, -Math.cos(yaw) * reach);
    this.lensMaterial.emissiveIntensity = active * 2;
    this.beamMaterial.opacity = active * 0.24;
    this.poolMaterial.opacity = active * 0.9;
  }

  dispose() {
    this.lensMaterial.dispose();
    this.beamMaterial.dispose();
    this.poolMaterial.dispose();
  }
}

// ---------- Cooling tower ----------

const towerMaterial = standard("#d8d8d4");
const towerInsideMaterial = standard("#9c9d9a", { side: THREE.BackSide });

function hyperboloid(base: number, waist: number, top: number, height: number, from = 0, to = 1) {
  const waistY = height * 0.7;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const y = height * (from + (to - from) * (i / 24));
    const edge = y < waistY ? base : top;
    const t = (y - waistY) / (y < waistY ? waistY : height - waistY);
    points.push(new THREE.Vector2(waist + (edge - waist) * t * t, y));
  }
  return new THREE.LatheGeometry(points, 36);
}

export class CoolingTower {
  readonly group = new THREE.Group();
  private steam = new Smoke(30, MATERIALS.steam);
  private emitter = new Emitter();

  constructor(builder: StaticBuilder, [ox, oz]: [number, number], private radius: number, height: number) {
    const r = radius;
    builder.add(hyperboloid(r, r * 0.66, r * 0.78, height), towerMaterial, [ox, YARD_Y + 0.6, oz]);
    builder.add(hyperboloid(r * 0.97, r * 0.64, r * 0.76, height), towerInsideMaterial, [ox, YARD_Y + 0.6, oz]);
    const band = hyperboloid(r, r * 0.66, r * 0.78, height, 0.74, 0.84);
    builder.add(band, MATERIALS.band, [ox, YARD_Y + 0.6, oz], [1.012, 1, 1.012]);
    // Short legs under the shell
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      builder.box(MATERIALS.concrete, [ox + Math.cos(a) * r * 0.97, YARD_Y + 0.3, oz + Math.sin(a) * r * 0.97], [0.22, 0.6, 0.22], [0, -a, 0]);
    }
    this.group.add(this.steam.mesh);
    this.origin = [ox, YARD_Y + 0.6 + height, oz];
  }

  private origin: Vec3;

  // busy: slow steady steam. active: fast thick steam.
  tick(dt: number, busy: number, active: number) {
    if (busy > 0.05) {
      this.emitter.tick(dt, THREE.MathUtils.lerp(1.0, 0.18, active), () =>
        this.steam.emit(this.origin, 5, 2, this.radius * (1.1 + active * 0.5), this.radius * 0.9),
      );
    }
    this.steam.tick(dt);
  }

  dispose() {
    this.steam.mesh.dispose();
  }
}

// ---------- Trucks ----------

// Built once and cloned; clones share merged geometry. Faces +x, about 12 long.
let truckTemplate: THREE.Group | null = null;

export function createTruck(): THREE.Group {
  truckTemplate ??= mergedGroup((b) => {
    b.box(MATERIALS.trailer, [-1.6, 2.35, 0], [8.8, 2.9, 2.6]);
    b.box(MATERIALS.darkSteel, [-0.6, 0.8, 0], [11, 0.35, 1.8]); // chassis
    b.box(MATERIALS.cab, [4.55, 1.95, 0], [2.3, 2.3, 2.5]);
    b.box(MATERIALS.glass, [5.72, 2.4, 0], [0.06, 1.0, 2.2]);
    b.box(MATERIALS.darkSteel, [5.75, 1.1, 0], [0.1, 0.5, 2.3]); // bumper
    for (const x of [-4.6, -3.4, 2.6, 4.7]) {
      for (const z of [-1.1, 1.1]) b.cylinder(MATERIALS.tire, [x, 0.5, z], [0.5, 0.4, 0.5], [Math.PI / 2, 0, 0]);
    }
  });
  return truckTemplate.clone();
}
