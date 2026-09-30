// Extras earned as a machine's season token total grows: one builder per row
// of the ladder in milestone-ladder.ts. Six rows stand in the yard of every
// lot, placed so nothing overlaps the hall, machines, warehouse slots or
// worker routes on any tier. The four rows too big for a yard stand on the
// user's HQ instead (see hq.ts). Everything is baked into a static mesh,
// except the wind turbine and the blimp, which move and come back as
// `Animated`. The parked cars of rows 2 to 4 are added by the lot itself
// through addParkedCars.

import * as THREE from "three";
import { addTruckParts, CARGO_MATERIAL, mergedGroup, YARD_Y } from "./machines.ts";
import { MATERIALS } from "./palette.ts";
import type { StaticBuilder } from "./static-builder.ts";

export type Animated = { group: THREE.Group; tick(dt: number): void };

// What a yard row is given: only the lot's accent material, which fades with
// the hall when the session is idle.
export type LotContext = { accent: THREE.Material };

// What an HQ row is given: the user's tint, and the box of the tower, whose
// height depends on how many rows that user has earned.
export type HqContext = {
  accent: THREE.Material;
  tower: { x0: number; z0: number; x1: number; z1: number; top: number };
};

const BIKE_PAINTS = [MATERIALS.cab, MATERIALS.white, MATERIALS.darkSteel];

// 10M: a rack with 3 bikes against the hall front, right of the people door.
function bikeRack(b: StaticBuilder) {
  const y = YARD_Y;
  b.box(MATERIALS.steel, [3.3, y + 0.75, -3.2], [1.4, 0.06, 0.06]);
  for (const x of [2.7, 3.9]) b.box(MATERIALS.steel, [x, y + 0.38, -3.2], [0.06, 0.76, 0.06]);
  [2.8, 3.3, 3.8].forEach((x, i) => {
    // Wheels stand in the y-z plane, so the bike points along z with its front wheel at the rack.
    for (const z of [-3.2, -2.1]) b.cylinder(MATERIALS.tire, [x, y + 0.32, z], [0.32, 0.06, 0.32], [0, 0, Math.PI / 2]);
    b.box(BIKE_PAINTS[i], [x, y + 0.55, -2.65], [0.06, 0.06, 1.1]); // frame
    b.box(BIKE_PAINTS[i], [x, y + 0.72, -2.4], [0.06, 0.4, 0.06]); // seat post
    b.box(MATERIALS.darkSteel, [x, y + 0.94, -2.4], [0.12, 0.05, 0.28]); // seat
    b.box(MATERIALS.darkSteel, [x, y + 0.72, -3.0], [0.06, 0.5, 0.06]); // steering tube
    b.box(MATERIALS.darkSteel, [x, y + 0.98, -3.0], [0.46, 0.04, 0.04]); // handlebar
  });
}

// 100M: a flagpole on the HQ forecourt, flag in the user's tint.
function flagpole(b: StaticBuilder, ctx: HqContext): Animated[] {
  const [x, z] = [18.3, 13.5];
  b.cylinder(MATERIALS.concrete, [x, YARD_Y + 0.15, z], [0.45, 0.3, 0.45]);
  b.cylinder(MATERIALS.steel, [x, YARD_Y + 4.5, z], [0.08, 9, 0.08]);
  b.cylinder(MATERIALS.yellow, [x, YARD_Y + 9.1, z], [0.14, 0.2, 0.14]);
  b.box(ctx.accent, [x - 1.06, YARD_Y + 8.2, z], [2.0, 1.2, 0.06]);
  return [];
}

// 250M: a coffee cart and a picnic table with a parasol along the walkway.
function coffeeCorner(b: StaticBuilder, ctx: LotContext) {
  const y = YARD_Y;
  b.box(MATERIALS.white, [11, y + 0.95, 7.3], [2.6, 1.1, 1.6]);
  b.box(MATERIALS.wood, [11, y + 1.52, 7.3], [2.7, 0.06, 1.7]); // counter top
  b.box(MATERIALS.darkSteel, [11, y + 1.05, 8.12], [2.4, 0.5, 0.04]); // menu board, walkway side
  for (const x of [9.9, 12.1]) b.box(MATERIALS.steel, [x, y + 1.95, 8.0], [0.05, 0.9, 0.05]);
  b.box(MATERIALS.cab, [11, y + 2.4, 7.65], [2.9, 0.06, 1.2], [0.22, 0, 0]); // awning
  for (const z of [6.5, 8.1]) b.cylinder(MATERIALS.tire, [11.8, y + 0.32, z], [0.32, 0.12, 0.32], [Math.PI / 2, 0, 0]);

  b.box(MATERIALS.wood, [15.5, y + 0.76, 7.3], [1.8, 0.08, 0.8]);
  for (const s of [-1, 1]) {
    b.box(MATERIALS.wood, [15.5, y + 0.45, 7.3 + s * 0.65], [1.8, 0.06, 0.3]); // bench
    b.box(MATERIALS.darkSteel, [15.5 + s * 0.7, y + 0.38, 7.3], [0.08, 0.76, 0.08]); // leg
    b.box(MATERIALS.darkSteel, [15.5 + s * 0.7, y + 0.22, 7.3], [0.08, 0.06, 1.6]); // foot bar under the benches
  }
  b.cylinder(MATERIALS.steel, [15.5, y + 1.5, 7.3], [0.04, 2.4, 0.04]);
  b.cylinder(ctx.accent, [15.5, y + 2.66, 7.3], [1.05, 0.08, 1.05]); // parasol
}

// 500M: the truck is back at the dock bay, where the forklift unloads.
function parkedTruck(b: StaticBuilder) {
  addTruckParts(b, [-9, YARD_Y, 5.8]);
}

// 750M: a low sports car in the front left corner with 2 chargers behind it.
function chargingBay(b: StaticBuilder) {
  const y = YARD_Y;
  const [cx, cz] = [-13, 9.6];
  b.box(MATERIALS.yellow, [cx, y + 0.5, cz], [3.8, 0.5, 1.7]);
  b.box(MATERIALS.yellow, [cx - 0.5, y + 0.92, cz], [1.9, 0.38, 1.5]);
  b.box(MATERIALS.glass, [cx - 0.5, y + 0.93, cz], [1.96, 0.3, 1.54]);
  b.box(MATERIALS.darkSteel, [cx - 1.8, y + 0.95, cz], [0.2, 0.05, 1.6]); // spoiler
  for (const x of [cx + 1.25, cx - 1.25]) {
    for (const z of [cz + 0.78, cz - 0.78])
      b.cylinder(MATERIALS.tire, [x, y + 0.33, z], [0.33, 0.26, 0.33], [Math.PI / 2, 0, 0]);
  }
  for (const x of [-12, -14.5]) {
    b.box(MATERIALS.darkSteel, [x, y + 0.05, 11], [0.6, 0.1, 0.5]);
    b.box(MATERIALS.white, [x, y + 0.7, 11], [0.4, 1.4, 0.3]);
    b.box(CARGO_MATERIAL, [x, y + 1.15, 10.83], [0.34, 0.3, 0.02]); // screen band
  }
}

// 1B: a helipad with a helicopter in the middle of the HQ roof. The roof
// carries nothing else, so the pad is centered and the rotor keeps its 6 units
// of clearance in both directions, whatever the tower grew to.
function helipad(b: StaticBuilder, ctx: HqContext): Animated[] {
  const { tower } = ctx;
  const roof = tower.top + 0.3; // top of the roof slab
  const cx = (tower.x0 + tower.x1) / 2;
  const cz = (tower.z0 + tower.z1) / 2;
  b.cylinder(MATERIALS.white, [cx, roof + 0.02, cz], [2.0, 0.04, 2.0]);
  b.cylinder(MATERIALS.darkSteel, [cx, roof + 0.045, cz], [1.75, 0.03, 1.75]);
  for (const x of [cx - 0.55, cx + 0.55]) b.box(MATERIALS.white, [x, roof + 0.07, cz], [0.28, 0.02, 1.6]);
  b.box(MATERIALS.white, [cx, roof + 0.07, cz], [0.85, 0.02, 0.28]);

  const g = roof + 0.08;
  for (const s of [-1, 1]) {
    b.box(MATERIALS.darkSteel, [cx + s * 0.75, g + 0.06, cz], [0.1, 0.1, 2.6]); // skid
    for (const z of [cz - 0.6, cz + 0.6]) b.box(MATERIALS.darkSteel, [cx + s * 0.75, g + 0.4, z], [0.07, 0.6, 0.07]);
  }
  b.box(MATERIALS.cab, [cx, g + 1.25, cz], [1.5, 1.2, 2.6]); // body, nose to -z
  b.box(MATERIALS.white, [cx, g + 1.25, cz], [1.56, 0.25, 2.62]); // stripe
  b.box(MATERIALS.glass, [cx, g + 1.35, cz - 1.32], [1.3, 0.9, 0.08]); // windscreen
  b.box(MATERIALS.white, [cx, g + 1.35, cz + 2.45], [0.36, 0.36, 2.3]); // tail boom, toward the front
  b.box(MATERIALS.cab, [cx, g + 1.95, cz + 3.4], [0.08, 0.9, 0.5]); // fin
  b.box(MATERIALS.darkSteel, [cx + 0.25, g + 1.95, cz + 3.45], [0.04, 1.1, 0.12]); // tail rotor
  b.cylinder(MATERIALS.darkSteel, [cx, g + 2.05, cz], [0.09, 0.5, 0.09]); // mast
  b.cylinder(MATERIALS.darkSteel, [cx, g + 2.34, cz], [0.22, 0.14, 0.22]); // hub
  b.box(MATERIALS.darkSteel, [cx, g + 2.4, cz], [6.0, 0.05, 0.28]);
  b.box(MATERIALS.darkSteel, [cx, g + 2.4, cz], [0.28, 0.05, 6.0]);
  return [];
}

// 2.5B: a wind turbine at the front left of the HQ plot. The rotor faces +z,
// so the blades sweep above the road, and turns whether busy or idle.
function windTurbine(b: StaticBuilder): Animated[] {
  const [x, z] = [-18.3, 5.5];
  const hubY = YARD_Y + 12.3;
  b.cylinder(MATERIALS.concrete, [x, YARD_Y + 0.2, z], [0.8, 0.4, 0.8]);
  b.cylinder(MATERIALS.white, [x, YARD_Y + 6.2, z], [0.32, 12, 0.32]);
  b.box(MATERIALS.white, [x, hubY, z + 0.2], [0.8, 0.8, 1.6]); // nacelle, hub end toward +z
  const rotor = mergedGroup((r) => {
    r.cylinder(MATERIALS.darkSteel, [0, 0, 0], [0.3, 0.4, 0.3], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3;
      r.box(MATERIALS.white, [Math.sin(a) * 2.1, Math.cos(a) * 2.1, 0], [0.32, 4.0, 0.1], [0, 0, -a]);
    }
  });
  rotor.position.set(x, hubY, z + 1.05);
  return [
    {
      group: rotor,
      tick: (dt) => {
        rotor.rotation.z -= dt * 0.9;
      },
    },
  ];
}

// 5B: a blimp in the user's tint tethered to the HQ roof, bobbing 0.6 over 6
// seconds. Its height is measured from the roof, not from the ground: the
// tower grows a floor per row, so a fixed altitude would end up inside it.
const BLIMP_RISE = 12;
const hullGeometry = new THREE.SphereGeometry(1, 24, 14);

function blimp(_b: StaticBuilder, ctx: HqContext): Animated[] {
  const { tower } = ctx;
  const y = tower.top + BLIMP_RISE;
  const tether = BLIMP_RISE + 0.7; // long enough to stay in the roof at the top of the bob
  const group = mergedGroup((g) => {
    g.add(hullGeometry, ctx.accent, [0, 0, 0], [5, 1.75, 1.75]);
    for (const [sy, sz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      g.box(MATERIALS.white, [-4.3, sy * 1.2, sz * 1.2], [1.1, sy ? 1.4 : 0.1, sz ? 1.4 : 0.1]);
    }
    g.box(MATERIALS.darkSteel, [0.4, -1.95, 0], [2.2, 0.55, 0.9]); // gondola
    g.cylinder(MATERIALS.darkSteel, [0.4, -2.2 - tether / 2, 0], [0.04, tether, 0.04]);
  });
  // Moored at the back left corner of the roof, so its tether misses the helipad.
  group.position.set(tower.x0 + 2.5, y, tower.z0 + 2.5);
  let t = 0;
  return [
    {
      group,
      tick: (dt) => {
        t += dt;
        group.position.y = y + Math.sin((t * 2 * Math.PI) / 6) * 0.6;
      },
    },
  ];
}

function noExtra() {}

// One entry per row of MILESTONES, in the same order, tagged with where its
// extra stands. Keeping both kinds in one table is what makes a row that
// lands in neither place, or in both, visible at a glance. Rows 2, 3 and 4
// add a parked car that the lot adds itself through addParkedCars, so row 4
// only builds its flagpole here.
type Row =
  | { at: "lot"; build: (b: StaticBuilder, ctx: LotContext) => void }
  | { at: "hq"; build: (b: StaticBuilder, ctx: HqContext) => Animated[] }; // what the row adds that moves

const ROWS: Row[] = [
  { at: "lot", build: bikeRack },
  { at: "lot", build: noExtra },
  { at: "lot", build: noExtra },
  { at: "hq", build: flagpole },
  { at: "lot", build: coffeeCorner },
  { at: "lot", build: parkedTruck },
  { at: "lot", build: chargingBay },
  { at: "hq", build: helipad },
  { at: "hq", build: windTurbine },
  { at: "hq", build: blimp },
];

// Adds the first `count` rows that stand in a yard. None of them move, so a
// lot has nothing to tick.
export function buildLotMilestones(builder: StaticBuilder, count: number, ctx: LotContext) {
  for (const row of ROWS.slice(0, count)) if (row.at === "lot") row.build(builder, ctx);
}

// Adds the first `count` rows that stand on the HQ. The turbine and the blimp
// come back to be added to the structure and ticked.
export function buildHqMilestones(builder: StaticBuilder, count: number, ctx: HqContext): Animated[] {
  const animated: Animated[] = [];
  for (const row of ROWS.slice(0, count)) {
    if (row.at === "hq") animated.push(...row.build(builder, ctx));
  }
  return animated;
}
