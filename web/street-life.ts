// Day-part aware terraces and park visitors. The scene owns a fixed five
// meshes; configuration only changes their instance matrices and counts.

import * as THREE from "three";
import type { CityActivity, CityClaim } from "./city-events.ts";
import { standard } from "./palette.ts";
import { hashString, PLOT_SIZE } from "./plots.ts";

const MAX_TABLES = 30;
const MAX_PARASOLS = 24;
const MAX_VISITORS = 72;

const tableGeometry = new THREE.CylinderGeometry(0.65, 0.65, 0.09, 8).translate(0, 0.75, 0);
const tableLegGeometry = new THREE.CylinderGeometry(0.07, 0.1, 0.72, 6).translate(0, 0.36, 0);
const parasolGeometry = new THREE.ConeGeometry(1.3, 0.48, 8).translate(0, 2.3, 0);
const visitorBodyGeometry = new THREE.CapsuleGeometry(0.3, 0.7, 2, 5).translate(0, 0.98, 0);
const visitorHeadGeometry = new THREE.SphereGeometry(0.26, 6, 4).translate(0, 1.78, 0);

const woodMaterial = standard("#9a6a3d", { roughness: 0.9 });
const steelMaterial = standard("#485156", { roughness: 0.75 });
const coloredMaterial = standard("#ffffff", { roughness: 0.85 });
const skinMaterial = standard("#d5a478", { roughness: 0.9 });

function mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, maximum: number) {
  const result = new THREE.InstancedMesh(geometry, material, maximum);
  result.name = name;
  result.count = 0;
  result.frustumCulled = false;
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function randomFor(claim: CityClaim, salt: string) {
  let state = hashString(`${salt}:${claim.cell.col}:${claim.cell.row}:${claim.amenity}`) || 1;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 4294967296;
  };
}

const TERRACE_AMENITIES = new Set<CityClaim["amenity"]>(["shops", "plein1944", "waalkade"]);
const PARK_AMENITIES = new Set<CityClaim["amenity"]>(["park", "goffert", "valkhof", "kronenburgerpark", "field"]);

export type StreetLifeSnapshot = {
  tables: number;
  parasols: number;
  visitors: number;
  drawCalls: number;
  instances: number;
};

export class StreetLife {
  readonly group = new THREE.Group();

  private readonly tables = mesh("streetlife-tables", tableGeometry, woodMaterial, MAX_TABLES);
  private readonly tableLegs = mesh("streetlife-table-legs", tableLegGeometry, steelMaterial, MAX_TABLES);
  private readonly parasols = mesh("streetlife-parasols", parasolGeometry, coloredMaterial, MAX_PARASOLS);
  private readonly visitors = mesh("streetlife-visitors", visitorBodyGeometry, coloredMaterial, MAX_VISITORS);
  private readonly heads = mesh("streetlife-heads", visitorHeadGeometry, skinMaterial, MAX_VISITORS);
  private claims: CityClaim[] = [];
  private activity: CityActivity = { hour: 12, busyRatio: 0, event: "ordinary" };
  private readonly matrix = new THREE.Matrix4();
  private readonly rotation = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly color = new THREE.Color();

  constructor() {
    this.group.name = "street-life";
    this.group.add(this.tables, this.tableLegs, this.parasols, this.visitors, this.heads);
  }

  setCity(claims: readonly CityClaim[], activity: CityActivity) {
    this.claims = [...claims].sort(
      (a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col || a.amenity.localeCompare(b.amenity),
    );
    this.activity = this.normalise(activity);
    this.redraw();
  }

  setActivity(activity: CityActivity) {
    this.activity = this.normalise(activity);
    this.redraw();
  }

  snapshot(): StreetLifeSnapshot {
    const meshes = this.group.children as THREE.InstancedMesh[];
    return {
      tables: this.tables.count,
      parasols: this.parasols.count,
      visitors: this.visitors.count,
      drawCalls: meshes.filter((entry) => entry.count > 0).length,
      instances: meshes.reduce((sum, entry) => sum + entry.count, 0),
    };
  }

  private normalise(activity: CityActivity): CityActivity {
    return {
      ...activity,
      hour: (((Number.isFinite(activity.hour) ? activity.hour : 12) % 24) + 24) % 24,
      busyRatio: THREE.MathUtils.clamp(activity.busyRatio || 0, 0, 1),
    };
  }

  private redraw() {
    for (const child of this.group.children as THREE.InstancedMesh[]) child.count = 0;

    const terraceOpen = this.activity.hour >= 10 && this.activity.hour < 23;
    const parksOpen = this.activity.hour >= 8 && this.activity.hour < 21;
    let tableIndex = 0;
    let parasolIndex = 0;
    let visitorIndex = 0;

    for (const claim of this.claims) {
      if (terraceOpen && TERRACE_AMENITIES.has(claim.amenity) && tableIndex < MAX_TABLES) {
        const random = randomFor(claim, "terrace");
        const count = Math.min(6, 1 + Math.round(this.activity.busyRatio * 4));
        for (let i = 0; i < count && tableIndex < MAX_TABLES; i++) {
          const x = claim.cell.col * PLOT_SIZE - 12 + (i % 3) * 6 + (random() - 0.5);
          const z = claim.cell.row * PLOT_SIZE + 15 + Math.floor(i / 3) * 4.5;
          this.setMatrix(this.tables, tableIndex, x, z, 0);
          this.setMatrix(this.tableLegs, tableIndex, x, z, 0);
          if (i % 2 === 0 && parasolIndex < MAX_PARASOLS) {
            this.setColoredMatrix(
              this.parasols,
              parasolIndex++,
              x,
              z,
              0,
              claim.amenity === "plein1944" ? "#b63a35" : "#e3cf91",
            );
          }
          if (visitorIndex < MAX_VISITORS && this.activity.busyRatio >= 0.2) {
            this.setVisitor(visitorIndex++, x + 1.05, z + (i % 2 ? -0.5 : 0.5), i);
          }
          tableIndex++;
        }
      }

      if (parksOpen && PARK_AMENITIES.has(claim.amenity) && visitorIndex < MAX_VISITORS) {
        const random = randomFor(claim, "park-visitors");
        const count = Math.min(10, 1 + Math.round(this.activity.busyRatio * 7));
        for (let i = 0; i < count && visitorIndex < MAX_VISITORS; i++) {
          const x = claim.cell.col * PLOT_SIZE + (random() - 0.5) * 30;
          const z = claim.cell.row * PLOT_SIZE + (random() - 0.5) * 30;
          this.setVisitor(visitorIndex++, x, z, i + claim.cell.col);
        }
      }
    }

    this.tables.count = this.tableLegs.count = tableIndex;
    this.parasols.count = parasolIndex;
    this.visitors.count = this.heads.count = visitorIndex;
    for (const child of this.group.children as THREE.InstancedMesh[]) {
      if (child.count === 0) continue;
      child.instanceMatrix.needsUpdate = true;
      if (child.instanceColor) child.instanceColor.needsUpdate = true;
    }
  }

  private setVisitor(index: number, x: number, z: number, paletteIndex: number) {
    const colors = ["#3d7182", "#d37b38", "#7a5d8c", "#547849", "#b84949"];
    this.setColoredMatrix(this.visitors, index, x, z, 0, colors[Math.abs(paletteIndex) % colors.length]);
    this.setMatrix(this.heads, index, x, z, 0);
  }

  private setMatrix(mesh: THREE.InstancedMesh, index: number, x: number, z: number, angle: number) {
    this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
    this.matrix.compose(this.position.set(x, 0, z), this.rotation, this.scale);
    mesh.setMatrixAt(index, this.matrix);
  }

  private setColoredMatrix(
    mesh: THREE.InstancedMesh,
    index: number,
    x: number,
    z: number,
    angle: number,
    color: string,
  ) {
    this.setMatrix(mesh, index, x, z, angle);
    mesh.setColorAt(index, this.color.set(color));
  }
}
