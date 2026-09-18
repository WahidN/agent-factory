// Zoom-dependent labels for Nijmegen's fixed landmarks. The DOM is updated
// only when the camera or city contents changed, not on every steady frame.

import * as THREE from "three";
import { BRIDGES, claimedUpTo, RAIL_BRIDGE, WAAL_EDGE } from "./city-plan.ts";
import type { RiverBounds } from "./park.ts";
import { PLOT_SIZE } from "./plots.ts";

type LabelSpec = { key: string; name: string; x: number; y: number; z: number; minZoom: number; kind: string };

const NAMES: Partial<Record<string, { name: string; y: number; minZoom?: number }>> = {
  goffert: { name: "Goffertstadion", y: 8 },
  stevenskerk: { name: "Stevenskerk", y: 39, minZoom: 0.14 },
  plein1944: { name: "Plein 1944", y: 17 },
  kronenburgerpark: { name: "Kronenburgerpark", y: 19 },
  station: { name: "Station Nijmegen", y: 22 },
  valkhof: { name: "Valkhof", y: 16 },
  waalkade: { name: "Waalkade", y: 13 },
};

export function landmarkLabelSpecs(rankCount: number, river: RiverBounds | null): LabelSpec[] {
  const specs: LabelSpec[] = claimedUpTo(rankCount).flatMap(({ cell, amenity }): LabelSpec[] => {
    const label = NAMES[amenity];
    if (!label) return [];
    return [
      {
        key: amenity,
        name: label.name,
        x: cell.col * PLOT_SIZE,
        y: label.y,
        z: cell.row * PLOT_SIZE,
        minZoom: label.minZoom ?? 0.17,
        kind: "place",
      },
    ];
  });
  if (!river) return specs;

  const riverZ = (WAAL_EDGE - 0.5) * PLOT_SIZE;
  for (const bridge of BRIDGES) {
    const x = (bridge.col - 0.5) * PLOT_SIZE;
    if (x < river.west || x > river.east) continue;
    specs.push({
      key: bridge.kind,
      name: bridge.kind === "waalbrug" ? "Waalbrug" : "De Oversteek",
      x,
      y: 18,
      z: riverZ,
      minZoom: 0.14,
      kind: "bridge",
    });
  }
  const railX = (RAIL_BRIDGE.col - 0.5) * PLOT_SIZE;
  if (railX >= river.west && railX <= river.east) {
    specs.push({ key: "spoorbrug", name: "Spoorbrug", x: railX, y: 14, z: riverZ, minZoom: 0.14, kind: "bridge" });
  }
  return specs;
}

export function labelOpacity(zoom: number, minZoom: number): number {
  return THREE.MathUtils.clamp((zoom - minZoom) / 0.22, 0, 1);
}

export class LandmarkLabels {
  private readonly root = document.createElement("div");
  private readonly labels = new Map<string, { spec: LabelSpec; el: HTMLElement }>();
  private readonly point = new THREE.Vector3();
  private readonly last = new Float64Array(8).fill(Number.NaN);
  private dirty = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.OrthographicCamera,
  ) {
    this.root.className = "landmark-labels";
    this.root.setAttribute("aria-hidden", "true");
    document.body.appendChild(this.root);
  }

  setCity(rankCount: number, river: RiverBounds | null) {
    const specs = landmarkLabelSpecs(rankCount, river);
    const wanted = new Set(specs.map((spec) => spec.key));
    for (const [key, label] of this.labels) {
      if (wanted.has(key)) continue;
      label.el.remove();
      this.labels.delete(key);
    }
    for (const spec of specs) {
      const existing = this.labels.get(spec.key);
      if (existing) {
        existing.spec = spec;
        continue;
      }
      const el = document.createElement("span");
      el.className = `landmark-label ${spec.kind}`;
      el.textContent = spec.name;
      this.root.appendChild(el);
      this.labels.set(spec.key, { spec, el });
    }
    this.dirty = true;
  }

  update() {
    const q = this.camera.quaternion;
    const current = [
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z,
      q.x,
      q.y,
      q.z,
      q.w,
      this.camera.zoom,
    ];
    if (!this.dirty && current.every((value, index) => Math.abs(value - this.last[index]) < 1e-6)) return;
    this.last.set(current);
    this.dirty = false;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    for (const { spec, el } of this.labels.values()) {
      const opacity = labelOpacity(this.camera.zoom, spec.minZoom);
      this.point.set(spec.x, spec.y, spec.z).project(this.camera);
      const onScreen =
        this.point.z >= -1 && this.point.z <= 1 && Math.abs(this.point.x) <= 1.08 && Math.abs(this.point.y) <= 1.08;
      if (!onScreen || opacity === 0) {
        el.hidden = true;
        continue;
      }
      el.hidden = false;
      el.style.opacity = opacity.toFixed(3);
      el.style.transform = `translate3d(${((this.point.x + 1) * width) / 2}px, ${((-this.point.y + 1) * height) / 2}px, 0)`;
    }
  }
}
