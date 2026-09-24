// Connects a bunch of fake machines to a running central, each reporting a
// handful of made up sessions that drift over time. Lets the wall display and
// the park layout be tested at scale without thirty real Macs open.
//
// Usage: pnpm fake-park
// Env: SPOKES, SESSIONS_PER_SPOKE, HUB, SEED, FREEZE (see the README).

import { startRelay, type Relay } from "../server/relay.ts";
import type { ServerMessage, SessionState } from "../server/types.ts";

const SPOKES = Number(process.env.SPOKES) || 10;
const SESSIONS_PER_SPOKE = Number(process.env.SESSIONS_PER_SPOKE) || 5;
const HUB = process.env.HUB ?? "ws://127.0.0.1:4317";
const SEED = process.env.SEED;
// Builds the park and then leaves it alone: no status flips, no sessions
// coming or going. Visual checks need a park that holds still long enough to
// follow one thing across two screenshots.
const FREEZE = process.env.FREEZE === "1";

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

// Real model ids, so a fake park sorts into the same lot sizes as a real one.
// tierFor in web/model-tier.ts matches on the family name, not the date.
const MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-5", "claude-opus-5", "claude-fable-5-1"];

const USERS = ["dennis", "wahid", "daan", "sara", "mo", "lynn", "abdel", "noor", "finn", "iris"];

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

// Builds one fake session. This is the only place the session shape is
// assembled, so a wire change only needs to touch this function.
function makeSession(rng: () => number, now: number, user: string): SessionState {
  const id = `s${nextSessionSeq++}`;
  const project = pick(rng, PROJECTS);
  const startedAt = now - Math.floor(randomBetween(rng, 0, 30 * 60_000));

  return {
    id,
    user,
    project,
    model: pick(rng, MODELS),
    status: rng() < 0.6 ? "busy" : "idle",
    subagents: Math.floor(randomBetween(rng, 0, 4)),
    startedAt,
  };
}

type Spoke = {
  machine: string;
  user: string;
  rng: () => number;
  relay: Relay | null;
  sessions: Map<string, SessionState>;
  connected: boolean;
};

// Uses the real relay: hello and a fresh snapshot on every connect, and the
// same exponential backoff with jitter a real reporter uses to come back
// after the hub restarts, so this script exercises the code under test
// instead of a simplified copy of it.
function connectSpoke(spoke: Spoke) {
  spoke.relay = startRelay(HUB, spoke.machine, spoke.user, "", () => [...spoke.sessions.values()], {
    log: (line) => {
      if (line.includes("connected")) spoke.connected = true;
      else if (line.includes("hub gone")) spoke.connected = false;
      console.log(`${new Date().toISOString()}  ${spoke.machine}  ${line}`);
    },
  });
}

// One small, plausible change: flip a status, add or drop a subagent, or
// occasionally add or remove a whole session.
function tick(spoke: Spoke, now: number) {
  const ids = [...spoke.sessions.keys()];
  const roll = spoke.rng();

  if (roll < 0.1 && spoke.sessions.size < SESSIONS_PER_SPOKE * 2) {
    const session = makeSession(spoke.rng, now, spoke.user);
    spoke.sessions.set(session.id, session);
    spoke.relay?.send({ type: "session-update", session } satisfies ServerMessage);
    return;
  }

  if (roll < 0.15 && ids.length > 1) {
    const id = pick(spoke.rng, ids);
    spoke.sessions.delete(id);
    spoke.relay?.send({ type: "session-removed", id } satisfies ServerMessage);
    return;
  }

  if (ids.length === 0) return;
  const id = pick(spoke.rng, ids);
  const session = spoke.sessions.get(id);
  if (!session) return;

  const changed: SessionState = { ...session };
  const detail = spoke.rng();
  if (detail < 0.5) {
    changed.status = changed.status === "busy" ? "idle" : "busy";
  } else if (detail < 0.8 && changed.subagents < 4) {
    changed.subagents += 1;
  } else if (changed.subagents > 0) {
    changed.subagents -= 1;
  }

  spoke.sessions.set(id, changed);
  spoke.relay?.send({ type: "session-update", session: changed } satisfies ServerMessage);
}

function makeSpoke(index: number): Spoke {
  const machine = `fake-${String(index + 1).padStart(2, "0")}`;
  const rng = makeRng(SEED ? `${SEED}:${machine}` : undefined);
  const user = pick(rng, USERS);
  const now = Date.now();
  const sessions = new Map<string, SessionState>();
  for (let i = 0; i < SESSIONS_PER_SPOKE; i++) {
    const session = makeSession(rng, now, user);
    sessions.set(session.id, session);
  }
  return { machine, user, rng, relay: null, sessions, connected: false };
}

console.log(
  `fake-park: connecting ${SPOKES} spoke(s) with ${SESSIONS_PER_SPOKE} session(s) each to ${HUB}` +
    (SEED ? ` (seed ${SEED})` : ""),
);

const spokes = Array.from({ length: SPOKES }, (_, index) => makeSpoke(index));

spokes.forEach((spoke, index) => {
  setTimeout(() => connectSpoke(spoke), index * CONNECT_SPREAD_MS);
});

function scheduleTick(spoke: Spoke) {
  const delay = randomBetween(spoke.rng, TICK_MIN_MS, TICK_MAX_MS);
  setTimeout(() => {
    if (spoke.connected) tick(spoke, Date.now());
    scheduleTick(spoke);
  }, delay);
}

if (!FREEZE) for (const spoke of spokes) scheduleTick(spoke);

setInterval(() => {
  const connected = spokes.filter((s) => s.connected).length;
  const totalSessions = spokes.reduce((sum, s) => sum + s.sessions.size, 0);
  console.log(`fake-park: ${connected}/${SPOKES} connected, ${totalSessions} session(s) live`);
}, STATUS_EVERY_MS);
