import * as THREE from "three";
import type { SessionState } from "../server/types.ts";
import { standard } from "./palette.ts";
import { TextBoard, wrapLines } from "./text-board.ts";

export type ScoreRecord = { title: string; holder: string; value: string };

const NO_MATCH = "Nog geen wedstrijd";

function byName(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}u ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function scoreRecords(sessions: readonly SessionState[], now: number): ScoreRecord[] {
  if (sessions.length === 0) return [];
  const records: ScoreRecord[] = [];

  let longest = sessions[0];
  let mostSub = sessions[0];
  for (const s of sessions) {
    if (s.startedAt < longest.startedAt || (s.startedAt === longest.startedAt && byName(s.user, longest.user) < 0)) {
      longest = s;
    }
    if (s.subagents > mostSub.subagents || (s.subagents === mostSub.subagents && byName(s.user, mostSub.user) < 0)) {
      mostSub = s;
    }
  }
  records.push({ title: "Langste sessie", holder: longest.user, value: duration(now - longest.startedAt) });
  if (mostSub.subagents > 0) {
    records.push({ title: "Meeste subagents", holder: mostSub.user, value: String(mostSub.subagents) });
  }

  const perProject = new Map<string, number>();
  for (const s of sessions) perProject.set(s.project, (perProject.get(s.project) ?? 0) + 1);
  let busiest = "";
  let busiestCount = 0;
  for (const [project, count] of perProject) {
    if (count > busiestCount || (count === busiestCount && byName(project, busiest) < 0)) {
      busiest = project;
      busiestCount = count;
    }
  }
  records.push({
    title: "Drukste project",
    holder: busiest,
    value: `${busiestCount} ${busiestCount === 1 ? "sessie" : "sessies"}`,
  });
  return records;
}

/** Two rows per record (title, then "holder, value"), each cut to `maxChars` so no row runs off the board. */
export function scoreLines(records: readonly ScoreRecord[], maxChars: number): string[] {
  if (records.length === 0) return [NO_MATCH];
  return records.flatMap((r) => [
    ...wrapLines(r.title, maxChars, 1),
    ...wrapLines(`${r.holder}, ${r.value}`, maxChars, 1),
  ]);
}

// A jumbotron, sized so its text reads in the overview (a world unit is ~3 px
// there): a header row plus up to three records of two rows each.
const BOARD_W = 30;
const BOARD_H = 21;
const ROWS = 7;
const FRAME = 0.6;
const MAST_H = 12;
// A stadium scoreboard on a mast: black face with white text, in a red-black
// frame like the NEC tribunes of the Goffert.
export class Scoreboard {
  readonly group = new THREE.Group();
  private readonly board: TextBoard;
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly red = standard("#b62f32");
  private readonly black = standard("#25272a");
  private lastKey = "";

  constructor() {
    this.board = new TextBoard({
      width: BOARD_W,
      height: BOARD_H,
      rows: ROWS,
      background: "#000000",
      foreground: "#ffe14a",
      glow: 0.6,
    });
    const centerY = MAST_H + BOARD_H / 2;
    this.board.group.position.set(0, centerY, FRAME / 2 + 0.01);
    this.group.add(this.board.group);

    this.part(this.black, [0, MAST_H / 2, 0], [1, MAST_H, 1]);
    this.part(this.red, [0, centerY, 0], [BOARD_W + FRAME * 2, BOARD_H + FRAME * 2, FRAME]);
    // The red slab sits behind the face; thin black strips give it the two-colour rim.
    this.part(this.black, [0, centerY + BOARD_H / 2 + FRAME / 2, 0], [BOARD_W + FRAME * 2, FRAME, FRAME + 0.1]);
    this.part(this.black, [0, centerY - BOARD_H / 2 - FRAME / 2, 0], [BOARD_W + FRAME * 2, FRAME, FRAME + 0.1]);
    this.update([], 0);
  }

  private part(material: THREE.Material, pos: [number, number, number], scale: [number, number, number]) {
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    this.group.add(mesh);
  }

  update(sessions: readonly SessionState[], now: number): void {
    const lines = ["GOFFERT", ...scoreLines(scoreRecords(sessions, now), this.board.maxChars)];
    const key = lines.join("\n");
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.board.setLines(lines);
  }

  place(x: number, z: number): void {
    this.group.position.set(x, 0, z);
  }

  tick(now: number): void {
    this.board.tick(now);
  }

  dispose(): void {
    this.board.dispose();
    this.geometry.dispose();
    this.red.dispose();
    this.black.dispose();
  }
}
