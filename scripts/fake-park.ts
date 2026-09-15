// Connects a bunch of fake machines to a running central, each reporting a
// handful of made up sessions that drift over time. Lets phase 3 and 4 (the
// wall display and the park layout at scale) be tested without thirty real
// Macs open.
//
// Usage: pnpm fake-park
// Env: SPOKES, SESSIONS_PER_SPOKE, HUB, SEED (see README below).

import { WebSocket } from "ws";
import { PROTOCOL, type RelayMessage } from "../server/hub.ts";
import type { AgentState, CurrentTool, ServerMessage, SessionState } from "../server/types.ts";

const SPOKES = Number(process.env.SPOKES) || 10;
const SESSIONS_PER_SPOKE = Number(process.env.SESSIONS_PER_SPOKE) || 5;
const HUB = process.env.HUB ?? "ws://127.0.0.1:4317";
const SEED = process.env.SEED;

const CONNECT_SPREAD_MS = 300;
const STATUS_EVERY_MS = 5_000;
const TICK_MIN_MS = 1_000;
const TICK_MAX_MS = 3_000;

const PROJECTS = [
  "agent-factory",
  "fleetview",
  "billing-api",
  "docs-site",
  "recipe-app",
  "market-data",
  "onboarding",
  "crm-sync",
  "image-pipeline",
  "status-page",
];

const MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-5-20251003",
  "claude-fable-1-20250815",
];

const TOOLS: CurrentTool[] = [
  { name: "Bash", target: "pnpm test" },
  { name: "Edit", target: "src/index.ts" },
  { name: "Read", target: "README.md" },
  { name: "Grep", target: "TODO" },
];

// A small seeded PRNG (mulberry32) so a run with SEED is reproducible. Falls
// back to Math.random when no SEED is given.
function makeRng(seed: string | undefined): () => number {
  if (!seed) return Math.random;
  let state = hashSeed(seed);
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  return hash;
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function randomBetween(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

let nextSessionSeq = 0;
let nextSubagentSeq = 0;

// Builds one fake session. This is the only place the session shape is
// assembled: phase 2 changes SessionState/AgentState to seven flat fields,
// and only this function needs to change when that lands.
function makeSession(rng: () => number, now: number): SessionState {
  const id = `s${nextSessionSeq++}`;
  const project = pick(rng, PROJECTS);
  const startedAt = now - Math.floor(randomBetween(rng, 0, 30 * 60_000));
  const subagentCount = Math.floor(randomBetween(rng, 0, 4));
  const subagents: AgentState[] = Array.from({ length: subagentCount }, () => makeSubagent(rng, now));

  return {
    id,
    name: project,
    folder: project,
    machine: "", // stamped by the hub on relay, left blank here
    status: rng() < 0.6 ? "busy" : "idle",
    currentTool: rng() < 0.7 ? pick(rng, TOOLS) : null,
    startedAt,
    model: pick(rng, MODELS),
    subagents,
  };
}

function makeSubagent(rng: () => number, now: number): AgentState {
  const id = `sub${nextSubagentSeq++}`;
  return {
    id,
    name: `subagent-${id}`,
    folder: pick(rng, PROJECTS),
    machine: "",
    status: rng() < 0.6 ? "busy" : "idle",
    currentTool: rng() < 0.7 ? pick(rng, TOOLS) : null,
    startedAt: now - Math.floor(randomBetween(rng, 0, 5 * 60_000)),
    model: pick(rng, MODELS),
  };
}

type Spoke = {
  machine: string;
  rng: () => number;
  socket: WebSocket | null;
  sessions: Map<string, SessionState>;
  connected: boolean;
};

function send(spoke: Spoke, message: RelayMessage) {
  if (spoke.socket?.readyState === WebSocket.OPEN) spoke.socket.send(JSON.stringify(message));
}

function sendSnapshot(spoke: Spoke) {
  const sessions = [...spoke.sessions.values()];
  send(spoke, { type: "snapshot", sessions } satisfies ServerMessage);
}

function connectSpoke(spoke: Spoke) {
  const url = new URL("/relay", HUB).toString();
  const socket = new WebSocket(url);
  spoke.socket = socket;
  socket.on("open", () => {
    spoke.connected = true;
    send(spoke, { type: "hello", machine: spoke.machine, protocol: PROTOCOL });
    sendSnapshot(spoke);
  });
  socket.on("close", () => {
    spoke.connected = false;
  });
  socket.on("error", () => {}); // a close always follows
}

// One small, plausible change: flip a status, add or drop a subagent, or
// occasionally add or remove a whole session.
function tick(spoke: Spoke, now: number) {
  const ids = [...spoke.sessions.keys()];
  const roll = spoke.rng();

  if (roll < 0.1 && spoke.sessions.size < SESSIONS_PER_SPOKE * 2) {
    const session = makeSession(spoke.rng, now);
    spoke.sessions.set(session.id, session);
    send(spoke, { type: "session-update", session } satisfies ServerMessage);
    return;
  }

  if (roll < 0.15 && ids.length > 1) {
    const id = pick(spoke.rng, ids);
    spoke.sessions.delete(id);
    send(spoke, { type: "session-removed", id } satisfies ServerMessage);
    return;
  }

  if (ids.length === 0) return;
  const id = pick(spoke.rng, ids);
  const session = spoke.sessions.get(id);
  if (!session) return;

  const changed: SessionState = { ...session, subagents: [...session.subagents] };
  const detail = spoke.rng();
  if (detail < 0.4) {
    changed.status = changed.status === "busy" ? "idle" : "busy";
    changed.currentTool = changed.status === "busy" && spoke.rng() < 0.7 ? pick(spoke.rng, TOOLS) : null;
  } else if (detail < 0.7 && changed.subagents.length < 4) {
    changed.subagents.push(makeSubagent(spoke.rng, now));
  } else if (changed.subagents.length > 0) {
    changed.subagents.splice(Math.floor(randomBetween(spoke.rng, 0, changed.subagents.length)), 1);
  } else {
    changed.currentTool = spoke.rng() < 0.5 ? pick(spoke.rng, TOOLS) : null;
  }

  spoke.sessions.set(id, changed);
  send(spoke, { type: "session-update", session: changed } satisfies ServerMessage);
}

function makeSpoke(index: number): Spoke {
  const machine = `fake-${String(index + 1).padStart(2, "0")}`;
  const rng = makeRng(SEED ? `${SEED}:${machine}` : undefined);
  const now = Date.now();
  const sessions = new Map<string, SessionState>();
  for (let i = 0; i < SESSIONS_PER_SPOKE; i++) {
    const session = makeSession(rng, now);
    sessions.set(session.id, session);
  }
  return { machine, rng, socket: null, sessions, connected: false };
}

console.log(
  `fake-park: connecting ${SPOKES} spoke(s) with ${SESSIONS_PER_SPOKE} session(s) each to ${HUB}` +
    (SEED ? ` (seed ${SEED})` : ""),
);

const spokes = Array.from({ length: SPOKES }, (_, index) => makeSpoke(index));
const timers: NodeJS.Timeout[] = [];

spokes.forEach((spoke, index) => {
  const delay = index * CONNECT_SPREAD_MS;
  const connectTimer = setTimeout(() => connectSpoke(spoke), delay);
  timers.push(connectTimer);
});

function scheduleTick(spoke: Spoke) {
  const delay = randomBetween(spoke.rng, TICK_MIN_MS, TICK_MAX_MS);
  const timer = setTimeout(() => {
    if (spoke.connected) tick(spoke, Date.now());
    scheduleTick(spoke);
  }, delay);
  timers.push(timer);
}

for (const spoke of spokes) scheduleTick(spoke);

const statusTimer = setInterval(() => {
  const connected = spokes.filter((s) => s.connected).length;
  const totalSessions = spokes.reduce((sum, s) => sum + s.sessions.size, 0);
  console.log(`fake-park: ${connected}/${SPOKES} connected, ${totalSessions} session(s) live`);
}, STATUS_EVERY_MS);

process.on("SIGINT", () => {
  clearInterval(statusTimer);
  for (const timer of timers) clearTimeout(timer);
  for (const spoke of spokes) spoke.socket?.close();
  process.exit(0);
});
