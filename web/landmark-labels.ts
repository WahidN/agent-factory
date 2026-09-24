// Zoom-dependent labels for Nijmegen's fixed landmarks. The DOM is updated
// only when the camera or city contents changed, not on every steady frame.

import * as THREE from "three";
import { BRIDGES, claimedUpTo, RAIL_BRIDGE, WAAL_EDGE } from "./city-plan.ts";
import type { RiverBounds } from "./park.ts";
import { PLOT_SIZE } from "./plots.ts";

type LabelSpec = {
  key: string;
  name: string;
  x: number;
  y: number;
  z: number;
  minZoom: number;
  kind: string;
  priority: number;
};

export type ScreenLabel = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priority: number;
};

const NAMES: Partial<Record<string, { name: string; y: number; minZoom?: number }>> = {
  goffert: { name: "Goffertstadion", y: 8 },
  stevenskerk: { name: "Stevenskerk", y: 39, minZoom: 0.14 },
  plein1944: { name: "Plein 1944", y: 17 },
  kronenburgerpark: { name: "Kronenburgerpark", y: 19 },
  station: { name: "Station Nijmegen", y: 22 },
  valkhof: { name: "Valkhof", y: 16 },
  waalkade: { name: "Waalkade", y: 13 },
  linku: { name: "Linku · St. Canisiussingel", y: 16 },
};

const PRIORITY: Record<string, number> = {
  stevenskerk: 100,
  station: 95,
  goffert: 90,
  waalbrug: 85,
  valkhof: 80,
  plein1944: 75,
  oversteek: 70,
  spoorbrug: 65,
  waalkade: 60,
  kronenburgerpark: 55,
  linku: 72,
};

/**
 * Keeps overview labels legible by accepting the most important anchors first.
 * Coordinates describe the label's lower-left anchor: CSS translates the pill
 * upward from there, so the rectangle extends toward negative y.
 */
export function selectNonOverlappingLabels(labels: readonly ScreenLabel[], gap = 6): Set<string> {
  const accepted: ScreenLabel[] = [];
  const visible = new Set<string>();
  const overlaps = (a: ScreenLabel, b: ScreenLabel) => {
    const aLeft = a.x - 8;
    const aRight = aLeft + a.width;
    const aTop = a.y - a.height;
    const aBottom = a.y;
    const bLeft = b.x - 8;
    const bRight = bLeft + b.width;
    const bTop = b.y - b.height;
    const bBottom = b.y;
    return aLeft < bRight + gap && aRight + gap > bLeft && aTop < bBottom + gap && aBottom + gap > bTop;
  };

  for (const candidate of [...labels].sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key))) {
    if (accepted.some((label) => overlaps(candidate, label))) continue;
    accepted.push(candidate);
    visible.add(candidate.key);
  }
  return visible;
}

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
        priority: PRIORITY[amenity] ?? 50,
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
      priority: PRIORITY[bridge.kind] ?? 50,
    });
  }
  const railX = (RAIL_BRIDGE.col - 0.5) * PLOT_SIZE;
  if (railX >= river.west && railX <= river.east) {
    specs.push({
      key: "spoorbrug",
      name: "Spoorbrug",
      x: railX,
      y: 14,
      z: riverZ,
      minZoom: 0.14,
      kind: "bridge",
      priority: PRIORITY.spoorbrug,
    });
  }
  return specs;
}

export function labelOpacity(zoom: number, minZoom: number): number {
  return THREE.MathUtils.clamp((zoom - minZoom) / 0.22, 0, 1);
}

type Label = { spec: LabelSpec; el: HTMLElement; width: number; height: number; stale: boolean };

export class LandmarkLabels {
  private readonly root = document.createElement("div");
  // Each pill's size is cached: reading offsetWidth after writing a transform
  // in the frame loop would force a layout per label per frame. A size is
  // re-read only when it may have changed (new pill, new text, a resize that
  // can switch the font size), in one batch before update() writes anything.
  private readonly labels = new Map<string, Label>();
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
    window.addEventListener("resize", () => {
      for (const label of this.labels.values()) label.stale = true;
      this.dirty = true;
    });
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
        if (existing.spec.name !== spec.name) {
          existing.el.textContent = spec.name;
          existing.stale = true;
        }
        existing.spec = spec;
        continue;
      }
      const el = document.createElement("span");
      el.className = `landmark-label ${spec.kind}`;
      el.textContent = spec.name;
      this.root.appendChild(el);
      this.labels.set(spec.key, { spec, el, width: spec.name.length * 7 + 28, height: 24, stale: true });
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

    // Reads only, before any write below, so this costs at most one layout.
    // A hidden pill measures 0 and keeps its last size until it shows again.
    for (const label of this.labels.values()) {
      if (!label.stale || label.el.hidden) continue;
      const measuredWidth = label.el.offsetWidth;
      if (measuredWidth === 0) continue;
      label.width = measuredWidth;
      label.height = label.el.offsetHeight || label.height;
      label.stale = false;
    }

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const candidates: ScreenLabel[] = [];
    for (const { spec, el, width: labelWidth, height: labelHeight } of this.labels.values()) {
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
      const x = ((this.point.x + 1) * width) / 2;
      const y = ((-this.point.y + 1) * height) / 2;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      candidates.push({
        key: spec.key,
        x,
        y,
        width: labelWidth,
        height: labelHeight,
        priority: spec.priority,
      });
    }

    const visible = selectNonOverlappingLabels(candidates);
    for (const [key, { el }] of this.labels) if (!el.hidden && !visible.has(key)) el.hidden = true;
  }
}
