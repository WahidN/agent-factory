import * as THREE from "three";
import { claimedUpTo } from "./city-plan.ts";
import { PLOT_SIZE } from "./plots.ts";

export type TextBoardOptions = {
  /** Size of the board face in world units. */
  width: number;
  height: number;
  /** Number of text rows the face is divided into. */
  rows: number;
  /** CSS colours for the canvas. */
  background: string;
  foreground: string;
  /** Emissive glow so the board reads at night; 0 = none. */
  glow?: number;
};

// Canvas pixels per world unit, and the least time between two repaints.
const PIXELS_PER_UNIT = 100;
const MIN_REPAINT_MS = 100;
// Text height as a share of its row, and the left margin as a share of the row.
const TEXT_SHARE = 0.7;
const MARGIN_SHARE = 0.3;
// A monospace glyph is about 0.6 em wide.
const GLYPH_EM = 0.6;

/**
 * A flat board with a canvas texture for text that changes at runtime: the
 * ticker at the station and the scoreboard at the Goffert use it.
 *
 * - setLines() only marks the board dirty; tick() repaints at most 10 times a
 *   second, so a burst of events costs one repaint.
 * - `maxChars` is how many characters fit on one row; text is not wrapped or
 *   scaled here, so callers shorten it with wrapLines().
 * - One mesh, one material: one draw call per board.
 */
export class TextBoard {
  readonly group = new THREE.Group();
  readonly texture: THREE.CanvasTexture;
  /** Characters that fit on one row. */
  readonly maxChars: number;

  private readonly options: TextBoardOptions;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly rowHeight: number;
  private readonly mesh: THREE.Mesh;
  private lines: readonly string[] = [];
  private dirty = true;
  private lastPaint = Number.NEGATIVE_INFINITY;

  constructor(options: TextBoardOptions) {
    this.options = options;
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.max(1, Math.round(options.width * PIXELS_PER_UNIT));
    this.canvas.height = Math.max(1, Math.round(options.height * PIXELS_PER_UNIT));
    this.ctx = this.canvas.getContext("2d")!;
    this.rowHeight = this.canvas.height / Math.max(1, options.rows);
    this.maxChars = Math.floor(
      (this.canvas.width - 2 * MARGIN_SHARE * this.rowHeight) / (GLYPH_EM * TEXT_SHARE * this.rowHeight),
    );
    this.ctx.font = `${Math.round(this.rowHeight * TEXT_SHARE)}px monospace`;
    this.ctx.textBaseline = "middle";

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const glow = options.glow ?? 0;
    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.9,
      metalness: 0,
      ...(glow > 0 ? { emissiveMap: this.texture, emissive: new THREE.Color("#ffffff"), emissiveIntensity: glow } : {}),
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(options.width, options.height), material);
    this.group.add(this.mesh);
  }

  setLines(lines: readonly string[]): void {
    this.lines = lines;
    this.dirty = true;
  }

  tick(now: number): void {
    if (!this.dirty || now - this.lastPaint < MIN_REPAINT_MS) return;
    this.dirty = false;
    this.lastPaint = now;
    this.paint();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.texture.dispose();
  }

  private paint(): void {
    const { ctx, canvas, rowHeight, lines } = this;
    ctx.fillStyle = this.options.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = this.options.foreground;
    const rows = Math.min(lines.length, this.options.rows);
    for (let i = 0; i < rows; i++) {
      ctx.fillText(lines[i], rowHeight * MARGIN_SHARE, rowHeight * (i + 0.5));
    }
    this.texture.needsUpdate = true;
  }
}

/** Breaks text on word boundaries into at most `rows` lines of `max` chars; the last line ends in "…" when text is left over. */
export function wrapLines(text: string, max: number, rows: number): string[] {
  const lines: string[] = [];
  let rest = text;
  while (rest !== "" && lines.length < rows) {
    if (rest.length <= max) {
      lines.push(rest);
      break;
    }
    const last = lines.length === rows - 1;
    const room = last ? max - 1 : max;
    const cut = rest.lastIndexOf(" ", room);
    const at = cut > 0 ? cut : room;
    const head = rest.slice(0, at);
    rest = rest.slice(at).trimStart();
    lines.push(last ? `${head}…` : head);
  }
  return lines;
}

/**
 * World position of a landmark cell, or null while the city has not grown far
 * enough to build it (claimedUpTo(rankCount) does not include it yet).
 */
export function landmarkPosition(amenity: string, rankCount: number): { x: number; z: number } | null {
  const claim = claimedUpTo(rankCount).find((c) => c.amenity === amenity);
  return claim ? { x: claim.cell.col * PLOT_SIZE, z: claim.cell.row * PLOT_SIZE } : null;
}
