// What is on a desk's screens. A busy session types: lines fill up, the block
// cursor blinks and the whole thing scrolls when it reaches the bottom. An
// idle one leaves its last screenful standing, dimmed, with no cursor.
//
// One canvas per desk, drawn at 8 frames a second and only while something
// changes. The monitor and the laptop share it, so a desk costs one texture
// and both its screens say the same thing.

import * as THREE from "three";
import { standard } from "./palette.ts";

const SIZE = { width: 256, height: 160 };
const BAR = 14; // title bar
const LINE = { height: 9, gap: 4, left: 10, indent: 9 };
const ROWS = Math.floor((SIZE.height - BAR - 10) / (LINE.height + LINE.gap));
const REDRAW_MS = 125;
// An idle screen is dark, with its last screenful barely readable: nobody is
// typing on it, but it has not been switched off either.
const IDLE_GLOW = 0.1;
const TYPE_MS = 260; // a new line this often while busy

type Line = { indent: number; width: number; accent: boolean };

// Same idea as the rest of the park: one seed in, the same screen out, so a
// desk keeps its own text instead of flickering into a new one every rebuild.
function nextSeed(seed: number): number {
  return (seed * 1103515245 + 12345) % 2147483648;
}

export class DeskScreen {
  readonly material: THREE.MeshStandardMaterial;

  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D | null;
  private texture: THREE.CanvasTexture;
  private accent: string;
  private lines: Line[] = [];
  private seed: number;
  private busy = false;
  private drawnAt = 0;
  private typedAt = 0;

  constructor(accent: THREE.Color, seed: number) {
    this.accent = `#${accent.getHexString()}`;
    this.seed = Math.abs(seed) % 2147483647 || 7;
    this.canvas.width = SIZE.width;
    this.canvas.height = SIZE.height;
    this.ctx = this.canvas.getContext("2d");
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // The map is also the emissive map, so the lit pixels are exactly the
    // pixels that glow. A dark screen then really is dark.
    this.material = standard("#ffffff", {
      map: this.texture,
      emissive: "#ffffff",
      emissiveMap: this.texture,
      emissiveIntensity: IDLE_GLOW,
    });
    for (let i = 0; i < ROWS; i++) this.addLine();
    this.draw();
  }

  setBusy(busy: boolean) {
    if (busy === this.busy) return;
    this.busy = busy;
    this.material.emissiveIntensity = busy ? 1 : IDLE_GLOW;
    this.draw();
  }

  tick(now: number) {
    if (!this.busy) return;
    if (now - this.typedAt >= TYPE_MS) {
      this.typedAt = now;
      this.addLine();
      if (this.lines.length > ROWS) this.lines.shift(); // scrolled off the top
    }
    if (now - this.drawnAt < REDRAW_MS) return;
    this.drawnAt = now;
    this.draw(now);
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
  }

  private addLine() {
    this.seed = nextSeed(this.seed);
    const roll = this.seed % 100;
    this.lines.push({
      indent: roll % 3,
      width: 60 + (roll % 7) * 22,
      accent: roll % 4 === 0,
    });
  }

  private draw(now = 0) {
    const ctx = this.ctx;
    if (!ctx) return; // no 2d context: the screen stays the colour it was
    ctx.fillStyle = this.busy ? "#0e131b" : "#0a0d12";
    ctx.fillRect(0, 0, SIZE.width, SIZE.height);

    ctx.fillStyle = this.busy ? "#1b2433" : "#141a24";
    ctx.fillRect(0, 0, SIZE.width, BAR);
    ctx.fillStyle = this.accent;
    ctx.fillRect(8, 5, 5, 5);
    ctx.fillStyle = "#3d4859";
    ctx.fillRect(18, 5, 5, 5);
    ctx.fillRect(28, 5, 5, 5);

    const dim = this.busy ? 1 : 0.35;
    for (const [i, line] of this.lines.entries()) {
      const y = BAR + 6 + i * (LINE.height + LINE.gap);
      ctx.globalAlpha = (line.accent ? 0.95 : 0.55) * dim;
      ctx.fillStyle = line.accent ? this.accent : "#93a3b8";
      ctx.fillRect(LINE.left + line.indent * LINE.indent, y, line.width, LINE.height);
    }
    ctx.globalAlpha = 1;

    // The cursor sits at the end of the last line and blinks twice a second.
    // An idle screen has none: nobody is typing on it.
    if (this.busy && Math.floor(now / 500) % 2 === 0) {
      const last = this.lines[this.lines.length - 1];
      const y = BAR + 6 + (this.lines.length - 1) * (LINE.height + LINE.gap);
      ctx.fillStyle = this.accent;
      ctx.fillRect(LINE.left + last.indent * LINE.indent + last.width + 4, y, 6, LINE.height);
    }
    this.texture.needsUpdate = true;
  }
}
