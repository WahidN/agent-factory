import * as THREE from "three";
import type { CityEvent, CityEventSink } from "./city-feed.ts";
import { MILESTONES } from "./milestone-ladder.ts";
import { standard } from "./palette.ts";
import { modelLabel, shortTokens } from "./sign-text.ts";
import { TextBoard, wrapLines } from "./text-board.ts";

const MAX_LINES = 5;
const IDLE_TEXT = "Nijmegen aan het werk";
const ROTATE_SECONDS = 4;

// Sized so the text still reads in the overview, where a world unit is ~3 px.
const BOARD_WIDTH = 52;
const BOARD_HEIGHT = 10;
const ROWS = 2;
const BOARD_BOTTOM = 7;
const POST_SIZE = 0.2;

function joinNames(names: readonly string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`;
}

export function formatEvent(event: CityEvent): string {
  switch (event.kind) {
    case "milestone":
      return `${event.user} haalt ${shortTokens(MILESTONES[event.row - 1])} tokens`;
    case "session-start":
      return `${event.user} start een ${modelLabel(event.model)}-sessie in ${event.project}`;
    case "collab-start":
      return `${joinNames(event.users)} werken samen aan ${event.project}`;
    case "kudos":
      return `Kudos voor ${event.user}!`;
  }
}

/** LED news ticker on two posts: the latest city events, one at a time. */
export class Ticker implements CityEventSink {
  readonly group = new THREE.Group();
  private readonly board: TextBoard;
  private readonly postGeometry = new THREE.BoxGeometry(POST_SIZE, BOARD_BOTTOM + BOARD_HEIGHT, POST_SIZE);
  private readonly postMaterial = standard("#3a3d42");
  private readonly lines: string[] = [];
  private shown = 0;
  private elapsed = 0;

  constructor() {
    this.board = new TextBoard({
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      rows: ROWS,
      background: "#120a02",
      foreground: "#ffa21f",
      glow: 1,
    });
    this.board.group.position.y = BOARD_BOTTOM + BOARD_HEIGHT / 2;
    this.group.add(this.board.group);

    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(this.postGeometry, this.postMaterial);
      post.position.set(sx * (BOARD_WIDTH / 2 - 0.5), (BOARD_BOTTOM + BOARD_HEIGHT) / 2, -0.15);
      post.castShadow = true;
      this.group.add(post);
    }
    this.paint();
  }

  push(event: CityEvent): void {
    this.lines.unshift(formatEvent(event));
    if (this.lines.length > MAX_LINES) this.lines.length = MAX_LINES;
    this.shown = 0;
    this.elapsed = 0;
    this.paint();
  }

  place(x: number, z: number): void {
    this.group.position.set(x, 0, z);
  }

  tick(dt: number, now: number): void {
    this.elapsed += dt;
    if (this.elapsed >= ROTATE_SECONDS) {
      this.elapsed = 0;
      if (this.lines.length > 1) {
        this.shown = (this.shown + 1) % this.lines.length;
        this.paint();
      }
    }
    this.board.tick(now);
  }

  dispose(): void {
    this.board.dispose();
    this.postGeometry.dispose();
    this.postMaterial.dispose();
  }

  private paint(): void {
    this.board.setLines(wrapLines(this.lines[this.shown] ?? IDLE_TEXT, this.board.maxChars, ROWS));
  }
}
