// The barriers where a road crosses the railway on the level. Two half
// barriers per crossing, diagonally opposite, each covering the right-hand
// half of the road on its own side of the track, the way a Dutch AHOB does.
//
// The booms swing, so they cannot go into the static city mesh. Their geometry
// runs up from the origin instead of being centred on it, so the pivot sits at
// the post and a per-instance rotation is the whole animation.

import * as THREE from "three";
import { standard } from "./palette.ts";
import { RAIL_X } from "./rail-corridor.ts";
import { BAKED_MATERIAL, StaticBuilder } from "./static-builder.ts";
import { MAX_CROSSINGS } from "./urban-mobility-logic.ts";

const POST_OFFSET = 7; // clear of the ballast, which is 8.6 wide
const ROAD_HALF = 5; // the post stands at the edge of the 10 wide road
const PIVOT_Y = 1.2;
const BOOM_LENGTH = 5.2;
const BAND = 0.8;

/** What the barriers need from the simulation to draw themselves. */
export type CrossingState = {
  crossingCount(): number;
  crossingZAt(index: number): number;
  boomAt(index: number): number;
};

const boomRed = standard("#c0362c");
const boomWhite = standard("#eceae2");
const postSteel = standard("#5b6369", { roughness: 0.7, metalness: 0.3 });
const crossWhite = standard("#e8e6dd");
const crossRed = standard("#b5332a");

function modelGeometry(build: (builder: StaticBuilder) => void): THREE.BufferGeometry {
  const builder = new StaticBuilder();
  build(builder);
  return (builder.build().children[0] as THREE.Mesh).geometry;
}

// Post, base and the Andreaskruis on top. The cross lies in the y-z plane, so
// it faces the road from both sides without a second model.
const postGeometry = modelGeometry((b) => {
  b.box(postSteel, [0, 0.08, 0], [0.7, 0.16, 0.7]);
  b.box(postSteel, [0, 1.25, 0], [0.26, 2.5, 0.26]);
  for (const tilt of [Math.PI / 4, -Math.PI / 4]) {
    b.box(crossWhite, [0, 2.95, 0], [0.09, 1.5, 0.16], [tilt, 0, 0]);
    for (const end of [0.62, -0.62]) {
      b.box(crossRed, [0, 2.95 + Math.cos(tilt) * end, Math.sin(tilt) * end], [0.1, 0.26, 0.17], [tilt, 0, 0]);
    }
  }
});

// The boom runs up from the origin in red and white bands, with the
// counterweight at the pivot. Straight up is open.
const boomGeometry = modelGeometry((b) => {
  b.box(postSteel, [0, -0.2, 0], [0.3, 0.4, 0.3]);
  for (let band = 0; band * BAND < BOOM_LENGTH; band++) {
    const length = Math.min(BAND, BOOM_LENGTH - band * BAND);
    b.box(band % 2 ? boomWhite : boomRed, [0, band * BAND + length / 2, 0], [0.15, length, 0.26]);
  }
});

/** Two instanced meshes for every crossing in the city: posts and booms. */
export class LevelCrossings {
  readonly group = new THREE.Group();
  private posts = new THREE.InstancedMesh(postGeometry, BAKED_MATERIAL, MAX_CROSSINGS * 2);
  private booms = new THREE.InstancedMesh(boomGeometry, BAKED_MATERIAL, MAX_CROSSINGS * 2);
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private quaternion = new THREE.Quaternion();
  private euler = new THREE.Euler();
  private scale = new THREE.Vector3(1, 1, 1);

  constructor() {
    this.group.name = "level-crossings";
    for (const mesh of [this.posts, this.booms]) {
      mesh.count = 0;
      mesh.frustumCulled = false; // the crossings sit far from the mesh origin
      // Moving instances leave frozen shadows since shadowMap.autoUpdate is off.
      mesh.castShadow = false;
      this.group.add(mesh);
    }
  }

  update(state: CrossingState): void {
    let slot = 0;
    for (let i = 0; i < state.crossingCount(); i++) {
      const z = state.crossingZAt(i);
      const down = state.boomAt(i);
      // West of the track the boom swings toward -z, east of it toward +z, so
      // each one lies across the lane of the traffic it holds.
      for (const side of [-1, 1]) {
        const x = RAIL_X + side * POST_OFFSET;
        const postZ = z - side * ROAD_HALF;
        this.place(this.posts, slot, x, 0, postZ, 0);
        this.place(this.booms, slot, x, PIVOT_Y, postZ, side * (Math.PI / 2) * down);
        slot++;
      }
    }
    this.posts.count = this.booms.count = slot;
    this.posts.instanceMatrix.needsUpdate = true;
    this.booms.instanceMatrix.needsUpdate = true;
  }

  private place(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, tilt: number): void {
    this.quaternion.setFromEuler(this.euler.set(tilt, 0, 0));
    this.matrix.compose(this.position.set(x, y, z), this.quaternion, this.scale);
    mesh.setMatrixAt(index, this.matrix);
  }
}
