// Seasonal city dressing for the moments that make Nijmegen recognisable.
//
// This module deliberately owns only a fixed set of InstancedMeshes. Changing
// event mode rewrites their matrices and counts, but never allocates scene
// objects or rebuilds meshes. That keeps Vierdaagse and match-day crowds cheap
// enough to leave enabled in a large city.

import * as THREE from "three";
import type { Amenity, Cell } from "./city-plan.ts";
import { clampHourAndBusy, InstanceWriter, instancedMesh, seededRandom, sortClaims } from "./instancing.ts";
import { standard } from "./palette.ts";
import { PLOT_SIZE } from "./plots.ts";
import { railSafeX } from "./rail-corridor.ts";

export type CityEventMode = "ordinary" | "vierdaagse" | "nec-matchday" | "market-day";

export type CityClaim = { cell: Cell; amenity: Amenity };

export type CityBounds = {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
};

export type CityActivity = {
  /** Local hour, from 0 up to (but not including) 24. */
  hour: number;
  /** Normalised city activity. Values outside 0..1 are safely clamped. */
  busyRatio: number;
  event?: CityEventMode;
};

const MAX_PEOPLE = 48;
const MAX_FLAGS = 12;
const MAX_FLOWERS = 36;
const MAX_STALLS = 10;

const bodyGeometry = new THREE.CapsuleGeometry(0.32, 0.75, 2, 5).translate(0, 1.02, 0);
const headGeometry = new THREE.SphereGeometry(0.28, 6, 4).translate(0, 1.86, 0);
const poleGeometry = new THREE.CylinderGeometry(0.04, 0.05, 2.6, 5).translate(0, 1.3, 0);
const flagGeometry = new THREE.PlaneGeometry(0.9, 0.55).translate(0.45, 2.27, 0);
const flowerGeometry = new THREE.ConeGeometry(0.18, 0.52, 6).translate(0, 1.72, 0);
const stallGeometry = new THREE.BoxGeometry(3, 1.25, 1.8).translate(0, 0.68, 0);
const canopyGeometry = new THREE.ConeGeometry(2.3, 0.75, 4).rotateY(Math.PI / 4).translate(0, 2.45, 0);

const whiteInstanceMaterial = standard("#ffffff", { roughness: 0.8 });
const skinMaterial = standard("#d8a879", { roughness: 0.9 });
const steelMaterial = standard("#414b4f", { roughness: 0.75 });
const flowerMaterial = standard("#e65782", { roughness: 0.9 });
const stallMaterial = standard("#a87548", { roughness: 0.95 });
const canopyMaterial = standard("#ffffff", { roughness: 0.82 });

function clampActivity(activity: CityActivity): CityActivity {
  return { ...clampHourAndBusy(activity), event: activity.event ?? "ordinary" };
}

function claimPosition(claim: CityClaim | undefined, fallback: { col: number; row: number }) {
  const cell = claim?.cell ?? fallback;
  return { x: cell.col * PLOT_SIZE, z: cell.row * PLOT_SIZE };
}

export type CityEventSnapshot = {
  mode: CityEventMode;
  people: number;
  flags: number;
  flowers: number;
  stalls: number;
  drawCalls: number;
  instances: number;
};

export class CityEvents {
  readonly group = new THREE.Group();

  private readonly people = instancedMesh("event-people", bodyGeometry, whiteInstanceMaterial, MAX_PEOPLE);
  private readonly heads = instancedMesh("event-heads", headGeometry, skinMaterial, MAX_PEOPLE);
  private readonly poles = instancedMesh("event-flag-poles", poleGeometry, steelMaterial, MAX_FLAGS);
  private readonly flags = instancedMesh("event-flags", flagGeometry, whiteInstanceMaterial, MAX_FLAGS, false, false);
  private readonly flowers = instancedMesh("event-gladioli", flowerGeometry, flowerMaterial, MAX_FLOWERS);
  private readonly stalls = instancedMesh("event-market-stalls", stallGeometry, stallMaterial, MAX_STALLS);
  private readonly canopies = instancedMesh("event-market-canopies", canopyGeometry, canopyMaterial, MAX_STALLS);
  private claims: CityClaim[] = [];
  private bounds: CityBounds = { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
  private activity: CityActivity = { hour: 12, busyRatio: 0, event: "ordinary" };
  private mode: CityEventMode = "ordinary";
  private readonly writer = new InstanceWriter();

  constructor() {
    this.group.name = "city-events";
    this.group.add(this.people, this.heads, this.poles, this.flags, this.flowers, this.stalls, this.canopies);
  }

  setCity(claims: readonly CityClaim[], bounds: CityBounds, activity: CityActivity) {
    this.claims = sortClaims(claims);
    this.bounds = { ...bounds };
    this.activity = clampActivity(activity);
    this.mode = this.activity.event ?? this.mode;
    this.redraw();
  }

  setMode(mode: CityEventMode) {
    if (mode === this.mode) return;
    this.setActivity({ ...this.activity, event: mode });
  }

  setActivity(activity: CityActivity) {
    this.activity = clampActivity({ ...activity, event: activity.event ?? this.mode });
    this.mode = this.activity.event ?? this.mode;
    this.redraw();
  }

  snapshot(): CityEventSnapshot {
    const meshes = this.group.children as THREE.InstancedMesh[];
    const people = this.people.count;
    const flags = this.flags.count;
    const flowers = this.flowers.count;
    const stalls = this.stalls.count;
    return {
      mode: this.mode,
      people,
      flags,
      flowers,
      stalls,
      drawCalls: meshes.filter((mesh) => mesh.count > 0).length,
      instances: meshes.reduce((sum, mesh) => sum + mesh.count, 0),
    };
  }

  private redraw() {
    for (const mesh of this.group.children as THREE.InstancedMesh[]) mesh.count = 0;
    if (this.mode === "ordinary" || this.claims.length === 0) return;

    if (this.mode === "vierdaagse") this.drawVierdaagse();
    else if (this.mode === "nec-matchday") this.drawNecMatchday();
    else this.drawMarketDay();
    this.commit();
  }

  private drawVierdaagse() {
    const plein = this.claims.find((claim) => claim.amenity === "plein1944");
    const anchor = claimPosition(plein, { col: 2, row: this.bounds.minRow });
    const random = seededRandom(`vierdaagse:${plein?.cell.col ?? 2}:${plein?.cell.row ?? this.bounds.minRow}`);
    const people = Math.min(MAX_PEOPLE, 14 + Math.round(this.activity.busyRatio * 26));
    const flags = Math.min(MAX_FLAGS, 6 + Math.round(this.activity.busyRatio * 5));

    for (let i = 0; i < people; i++) {
      const lane = (i % 4) - 1.5;
      const x = anchor.x - 25 + ((i * 4.1) % 50) + (random() - 0.5) * 1.2;
      const z = anchor.z - PLOT_SIZE / 2 + lane * 1.1 + (random() - 0.5) * 0.4;
      this.setPerson(i, x, z, i % 5 === 0 ? "#f0f0e8" : i % 2 === 0 ? "#e66b32" : "#3e75a6");
      if (i < MAX_FLOWERS) this.writer.setMatrix(this.flowers, i, x + 0.42, z + 0.18, i % 2 ? -0.25 : 0.25);
    }
    this.people.count = this.heads.count = people;
    this.flowers.count = Math.min(people, MAX_FLOWERS);

    for (let i = 0; i < flags; i++) {
      const x = anchor.x - 25 + (i / Math.max(1, flags - 1)) * 50;
      const z = anchor.z - PLOT_SIZE / 2 - 4.6;
      this.setFlag(i, x, z, i % 2 === 0 ? "#e7353c" : "#f2f1e8", Math.PI / 2);
    }
    this.poles.count = this.flags.count = flags;
  }

  private drawNecMatchday() {
    const goffert = this.claims.find((claim) => claim.amenity === "goffert");
    if (!goffert) return;
    const anchor = { x: goffert.cell.col * PLOT_SIZE, z: goffert.cell.row * PLOT_SIZE };
    const random = seededRandom(`nec:${goffert.cell.col}:${goffert.cell.row}`);
    const people = Math.min(MAX_PEOPLE, 12 + Math.round(this.activity.busyRatio * 34));
    const flags = Math.min(MAX_FLAGS, 4 + Math.round(this.activity.busyRatio * 6));
    for (let i = 0; i < people; i++) {
      const side = i % 4;
      const along = -20 + random() * 40;
      const offset = 18 + random() * 5;
      const x = side < 2 ? anchor.x + (side === 0 ? -offset : offset) : anchor.x + along;
      const z = side < 2 ? anchor.z + along : anchor.z + (side === 2 ? -offset : offset);
      this.setPerson(i, x, z, i % 3 === 0 ? "#202225" : "#c92f37");
    }
    this.people.count = this.heads.count = people;
    for (let i = 0; i < flags; i++) {
      const angle = (i / flags) * Math.PI * 2;
      this.setFlag(
        i,
        anchor.x + Math.cos(angle) * 24,
        anchor.z + Math.sin(angle) * 24,
        i % 2 ? "#1e2022" : "#d42f38",
        angle + Math.PI / 2,
      );
    }
    this.poles.count = this.flags.count = flags;
  }

  private drawMarketDay() {
    const plein = this.claims.find((claim) => claim.amenity === "plein1944");
    if (!plein) return;
    const anchor = { x: plein.cell.col * PLOT_SIZE, z: plein.cell.row * PLOT_SIZE };
    const random = seededRandom(`market:${plein.cell.col}:${plein.cell.row}`);
    const stalls = Math.min(MAX_STALLS, 4 + Math.round(this.activity.busyRatio * 5));
    const people = Math.min(MAX_PEOPLE, 8 + Math.round(this.activity.busyRatio * 24));
    for (let i = 0; i < stalls; i++) {
      const row = Math.floor(i / 5);
      const x = anchor.x - 12 + (i % 5) * 6;
      const z = anchor.z + 8 + row * 5;
      this.writer.setMatrix(this.stalls, i, x, z, 0);
      this.writer.setColoredMatrix(this.canopies, i, x, z, 0, i % 2 ? "#f0dfb3" : "#b83237");
    }
    this.stalls.count = this.canopies.count = stalls;
    for (let i = 0; i < people; i++) {
      const x = anchor.x - 15 + random() * 30;
      const z = anchor.z + 3 + random() * 16;
      this.setPerson(i, x, z, ["#456b79", "#c98235", "#6f5d87", "#4e7651"][i % 4]);
    }
    this.people.count = this.heads.count = people;
  }

  private setPerson(index: number, x: number, z: number, color: string) {
    const safeX = railSafeX(x);
    this.writer.setColoredMatrix(this.people, index, safeX, z, 0, color);
    this.writer.setMatrix(this.heads, index, safeX, z, 0);
  }

  private setFlag(index: number, x: number, z: number, color: string, angle: number) {
    this.writer.setMatrix(this.poles, index, x, z, angle);
    this.writer.setColoredMatrix(this.flags, index, x, z, angle, color);
  }

  private commit() {
    for (const mesh of this.group.children as THREE.InstancedMesh[]) {
      if (mesh.count === 0) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
