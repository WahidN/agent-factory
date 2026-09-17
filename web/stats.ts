// A tiny "?stats" overlay: draw calls, triangles, frame time (avg and p95),
// and the lot count. Only built and only fed when the URL has ?stats, so a
// normal visit pays nothing for it: no ring buffer, no interval, no per
// frame call at all.

import type * as THREE from "three";

export function statsRequested(search: string): boolean {
  return new URLSearchParams(search).has("stats");
}

// Fixed capacity ring buffer of frame times, oldest sample dropped first.
// Kept separate from the math below so both stay trivial to test.
export class RingBuffer {
  private buf: number[] = [];

  constructor(private readonly capacity: number) {}

  push(value: number) {
    this.buf.push(value);
    if (this.buf.length > this.capacity) this.buf.shift();
  }

  values(): number[] {
    return this.buf;
  }
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// The 95th percentile: the value below which 95% of the samples fall. An
// average hides exactly the stutters that matter here, so this is the
// number that actually tells you whether a frame is being missed.
export function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

const FRAME_WINDOW = 120; // about 2 seconds at 60 fps
const REFRESH_MS = 500;

// scene.ts builds and owns the renderer and does not hand it out. This grabs
// the instance without touching scene.ts or reassigning the (read only)
// "THREE" module namespace: WebGLRenderer's constructor assigns its methods
// as plain own properties (`this.setPixelRatio = function (...) {...}`), and
// a plain assignment still runs an inherited accessor's setter before it
// creates that own property. So a one shot setter on the prototype, defined
// before scene.ts ever constructs a renderer, is called with the new
// instance as `this`, right as the constructor sets it up (info is already
// attached on the instance by then).
export function interceptNextRenderer(renderer: typeof THREE.WebGLRenderer): {
  get(): THREE.WebGLRenderer | undefined;
} {
  let captured: THREE.WebGLRenderer | undefined;
  const prototype = renderer.prototype as { setPixelRatio?: unknown };
  Object.defineProperty(prototype, "setPixelRatio", {
    configurable: true,
    set(this: THREE.WebGLRenderer, fn: unknown) {
      captured = this;
      delete prototype.setPixelRatio;
      Object.defineProperty(this, "setPixelRatio", { value: fn, writable: true, configurable: true, enumerable: true });
    },
  });
  return { get: () => captured };
}

// How many lots are on the park, and how many of those are drawn in full
// detail. The gap between the two is what keeps the frame budget flat.
export type LotCount = { detailed: number; total: number };

export function createStatsOverlay(renderer: THREE.WebGLRenderer, countLots: () => LotCount) {
  const frameTimes = new RingBuffer(FRAME_WINDOW);

  // scene.ts renders through an EffectComposer, which calls renderer.render()
  // several times per frame (the scene pass, then a fullscreen quad per post
  // effect). With the default autoReset, renderer.info.render only ever
  // shows the *last* of those calls (a single 1 triangle output quad). Reset
  // it once per outer frame instead (see recordFrame below), right before
  // that frame's rendering starts, so every internal render() call in
  // between accumulates into one real per-frame total.
  renderer.info.autoReset = false;

  const el = document.createElement("div");
  el.id = "stats";
  Object.assign(el.style, {
    position: "fixed",
    top: "56px",
    right: "16px",
    padding: "8px 12px",
    borderRadius: "10px",
    background: "rgba(20, 24, 31, 0.82)",
    color: "#e8e8e8",
    fontSize: "12px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    lineHeight: "1.5",
    whiteSpace: "pre",
    pointerEvents: "none",
    zIndex: "10",
  });
  document.body.appendChild(el);

  function render() {
    const { calls, triangles } = renderer.info.render;
    const { detailed, total } = countLots();
    el.textContent = [
      `draw calls  ${calls}`,
      `triangles   ${triangles}`,
      `frame avg   ${average(frameTimes.values()).toFixed(1)} ms`,
      `frame p95   ${percentile95(frameTimes.values()).toFixed(1)} ms`,
      `lots        ${detailed} / ${total}`,
    ].join("\n");
  }

  const interval = setInterval(render, REFRESH_MS);
  render();

  return {
    recordFrame(ms: number) {
      frameTimes.push(ms);
      renderer.info.reset();
    },
    dispose() {
      clearInterval(interval);
      el.remove();
    },
  };
}
