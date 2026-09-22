// Glue: watches Claude Code files, feeds the tracker, streams state over WebSocket.
// Read-only on ~/.claude. Listens on 127.0.0.1 unless started with --hub.

import { watch, type FSWatcher } from "node:fs";
import { open, readdir, readFile, stat } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { basename, join } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import {
  dropPartialFirstLine,
  parseSessionFile,
  parseSubagentMeta,
  parseTranscriptChunk,
  projectDirFor,
  type SessionFile,
  type TranscriptEvent,
} from "./claude-reader.ts";
import { Hub, parseRelayMessage, PROTOCOL } from "./hub.ts";
import { startRelay } from "./relay.ts";
import { SessionTracker, SUBAGENT_REMOVE_MS } from "./session-tracker.ts";
import type { ServerMessage } from "./types.ts";

// `--hub` opens the port to the network and takes other machines' sessions on /relay.
// `HUB=ws://host:4317` sends our sessions to such a hub instead.
const IS_HUB = process.argv.includes("--hub");
const HUB_URL = process.env.HUB ?? "";
const HOST = IS_HUB ? "0.0.0.0" : "127.0.0.1";
const PORT = Number(process.env.PORT) || 4317;
// Short host name, `MACHINE=wahid` overrides the default Mac name.
const MACHINE = process.env.MACHINE || hostname().split(".")[0].toLowerCase();
const CLAUDE_DIR = join(homedir(), ".claude");
const SESSIONS_DIR = join(CLAUDE_DIR, "sessions");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");
const TAIL_BYTES = 64 * 1024;
const DEBOUNCE_MS = 50;
const CHECK_EVERY_MS = 5_000;

// ---------- WebSocket ----------

const wss = new WebSocketServer({ host: HOST, port: PORT });

function broadcast(message: ServerMessage) {
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

const tracker = new SessionTracker((message) => {
  log(message);
  broadcast(message);
  relay?.send(message);
}, MACHINE);

const relay = HUB_URL ? startRelay(HUB_URL, MACHINE, () => tracker.snapshot(Date.now())) : null;

// Browsers connect on /ws and get our sessions plus everything relayed to us.
// Other machines connect on /relay, hub mode only.
const hub = new Hub();
const reporters = new Map<string, WebSocket>(); // machine -> its open relay socket

wss.on("connection", (socket, request) => {
  if (request.url === "/relay") {
    if (IS_HUB) acceptReporter(socket, request.socket.remoteAddress ?? "?");
    else socket.close(1008, "not started with --hub");
    return;
  }
  const sessions = [...tracker.snapshot(Date.now()), ...hub.remote()];
  socket.send(JSON.stringify({ type: "snapshot", sessions } satisfies ServerMessage));
});

// ---------- Hub ----------

// The first message must be a hello with our protocol number. Every message
// after that is merged and broadcast. A close drops the machine's sessions.
function acceptReporter(socket: WebSocket, from: string) {
  let machine = "";
  socket.on("message", (data) => {
    const message = parseRelayMessage(data.toString());
    if (!machine) {
      if (message?.type !== "hello") return socket.close(1002, "expected hello");
      if (message.protocol !== PROTOCOL) {
        const time = new Date().toLocaleTimeString();
        console.log(`${time}  refused  ${message.machine}: protocol ${message.protocol}, this hub speaks ${PROTOCOL}`);
        return socket.close(1002, `protocol ${PROTOCOL} expected`);
      }
      machine = message.machine;
      // A machine that restarted before its old socket was seen dead takes over its own sessions.
      const old = reporters.get(machine);
      reporters.set(machine, socket);
      old?.terminate();
      hub.join(machine);
      console.log(`${new Date().toLocaleTimeString()}  joined   ${machine} from ${from}`);
      return;
    }
    if (!message || message.type === "hello") return;
    for (const out of hub.apply(machine, message)) {
      log(out);
      broadcast(out);
    }
  });
  socket.on("close", () => {
    if (!machine || reporters.get(machine) !== socket) return; // replaced by a newer socket
    reporters.delete(machine);
    for (const out of hub.leave(machine)) {
      log(out);
      broadcast(out);
    }
    console.log(`${new Date().toLocaleTimeString()}  left     ${machine}`);
  });
}

// ---------- Transcript tailing ----------

type Tail = { offset: number; remainder: Buffer };
type ReadResult = { events: TranscriptEvent[]; mtimeMs: number } | null;
const tails = new Map<string, Tail>();
const readQueues = new Map<string, Promise<unknown>>();

// Reads of the same file wait for each other, so no bytes are handled twice.
function readNewEvents(path: string): Promise<ReadResult> {
  const read = (readQueues.get(path) ?? Promise.resolve()).then(() => readNewEventsNow(path));
  readQueues.set(path, read.catch(() => {}));
  return read;
}

// Reads only bytes added since last time. On first sight, or if the file
// shrank, starts from the last 64 KB instead of reading the whole file.
async function readNewEventsNow(path: string): Promise<ReadResult> {
  const info = await stat(path).catch(() => null);
  if (!info) return null;

  let tail = tails.get(path);
  let fromMiddle = false;
  if (!tail || info.size < tail.offset) {
    const start = Math.max(0, info.size - TAIL_BYTES);
    tail = { offset: start, remainder: Buffer.alloc(0) };
    tails.set(path, tail);
    fromMiddle = start > 0;
  }
  if (info.size === tail.offset) return { events: [], mtimeMs: info.mtimeMs };

  const length = info.size - tail.offset;
  const chunk = Buffer.alloc(length);
  const handle = await open(path, "r");
  try {
    await handle.read(chunk, 0, length, tail.offset);
  } finally {
    await handle.close();
  }
  tail.offset = info.size;

  // Split on the last newline byte, so a half-written line (or a multi-byte
  // character cut in two) waits for the next read.
  const bytes = Buffer.concat([tail.remainder, chunk]);
  const lastNewline = bytes.lastIndexOf(0x0a);
  tail.remainder = Buffer.from(bytes.subarray(lastNewline + 1));
  let text = bytes.subarray(0, lastNewline + 1).toString("utf8");
  if (fromMiddle) text = dropPartialFirstLine(text);

  return { events: parseTranscriptChunk(text).entries, mtimeMs: info.mtimeMs };
}

// ---------- Sessions ----------

type Watched = { file: SessionFile; projectDir: string | null };
const watchedSessions = new Map<string, Watched>();

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 only checks, it does not kill
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function refreshSessions() {
  const names = await readdir(SESSIONS_DIR).catch(() => [] as string[]);
  const now = Date.now();
  const alive = new Set<string>();

  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const file = parseSessionFile(await readFile(join(SESSIONS_DIR, name), "utf8").catch(() => ""));
    if (!file || !isAlive(file.pid)) continue;
    alive.add(file.sessionId);
    tracker.upsertSession(file, now);
    const watched = watchedSessions.get(file.sessionId);
    if (watched) watched.file = file;
    else watchedSessions.set(file.sessionId, { file, projectDir: null });
  }

  for (const sessionId of tracker.sessionIds()) {
    if (!alive.has(sessionId)) forgetSession(sessionId);
  }

  for (const sessionId of alive) await syncSession(sessionId);
}

function forgetSession(sessionId: string) {
  const watched = watchedSessions.get(sessionId);
  watchedSessions.delete(sessionId);
  tracker.removeSession(sessionId);
  if (!watched?.projectDir) return;
  for (const path of tails.keys()) {
    if (path.includes(sessionId)) tails.delete(path);
  }
  unwatchProjectDirIfUnused(watched.projectDir);
}

// Finds the transcript folder. Normally derived from cwd; if that guess
// misses, look for <sessionId>.jsonl in every project folder.
async function findProjectDir(file: SessionFile): Promise<string | null> {
  const guess = join(PROJECTS_DIR, projectDirFor(file.cwd));
  if (await exists(join(guess, `${file.sessionId}.jsonl`))) return guess;
  for (const dir of await readdir(PROJECTS_DIR).catch(() => [] as string[])) {
    if (await exists(join(PROJECTS_DIR, dir, `${file.sessionId}.jsonl`))) return join(PROJECTS_DIR, dir);
  }
  return null;
}

// Reads anything new for a session and its subagents.
async function syncSession(sessionId: string) {
  const watched = watchedSessions.get(sessionId);
  if (!watched) return;
  if (!watched.projectDir) {
    watched.projectDir = await findProjectDir(watched.file);
    if (!watched.projectDir) return; // transcript not created yet, the 5 second check retries
    watchProjectDir(watched.projectDir);
  }
  await syncTranscript(sessionId);
  const subagentsDir = join(watched.projectDir, sessionId, "subagents");
  for (const name of await readdir(subagentsDir).catch(() => [] as string[])) {
    if (name.endsWith(".jsonl")) await syncSubagent(sessionId, name);
  }
}

async function syncTranscript(sessionId: string) {
  const watched = watchedSessions.get(sessionId);
  if (!watched?.projectDir) return;
  const result = await readNewEvents(join(watched.projectDir, `${sessionId}.jsonl`));
  if (result) tracker.applySessionEvents(sessionId, result.events, Date.now());
}

async function syncSubagent(sessionId: string, fileName: string) {
  const watched = watchedSessions.get(sessionId);
  if (!watched?.projectDir) return;
  const dir = join(watched.projectDir, sessionId, "subagents");
  const path = join(dir, fileName);
  const agentId = basename(fileName, ".jsonl");
  const now = Date.now();

  // Skip transcripts quiet for 60+ seconds, so a subagent the tracker removed
  // is not added back by the next periodic check.
  const info = await stat(path).catch(() => null);
  if (!info || now - info.mtimeMs >= SUBAGENT_REMOVE_MS) return;

  const result = await readNewEvents(path);
  if (!result) return;
  const meta = parseSubagentMeta(await readFile(join(dir, `${agentId}.meta.json`), "utf8").catch(() => ""));
  const subagent = { name: meta?.name ?? agentId, model: meta?.model ?? "" };
  tracker.applySubagentEvents(sessionId, agentId, subagent, result.events, result.mtimeMs, now);
}

// ---------- Watching ----------

const projectWatchers = new Map<string, FSWatcher>();
const timers = new Map<string, NodeJS.Timeout>();
const running = new Map<string, Promise<void>>();

// Waits 50 ms of quiet per key, and never runs the same key twice at once.
function debounce(key: string, task: () => Promise<void>) {
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      const previous = running.get(key) ?? Promise.resolve();
      const next = previous.then(task).catch((error) => console.error(`[${key}]`, error));
      running.set(key, next);
      next.finally(() => running.get(key) === next && running.delete(key));
    }, DEBOUNCE_MS),
  );
}

// One recursive watcher per project folder covers every session transcript
// in it and every subagents/ folder below it, including ones created later.
function watchProjectDir(dir: string) {
  if (projectWatchers.has(dir)) return;
  const watcher = watch(dir, { recursive: true }, (_event, fileName) => {
    if (!fileName) return;
    const parts = fileName.toString().split("/");
    if (parts.length === 1 && parts[0].endsWith(".jsonl")) {
      const sessionId = basename(parts[0], ".jsonl");
      if (watchedSessions.has(sessionId)) debounce(sessionId, () => syncTranscript(sessionId));
    } else if (parts.length === 3 && parts[1] === "subagents" && parts[2].endsWith(".jsonl")) {
      const [sessionId, , name] = parts;
      if (watchedSessions.has(sessionId)) debounce(`${sessionId}/${name}`, () => syncSubagent(sessionId, name));
    }
  });
  watcher.on("error", (error) => console.error(`[watch ${dir}]`, error));
  projectWatchers.set(dir, watcher);
}

function unwatchProjectDirIfUnused(dir: string) {
  for (const watched of watchedSessions.values()) {
    if (watched.projectDir === dir) return;
  }
  projectWatchers.get(dir)?.close();
  projectWatchers.delete(dir);
}

async function exists(path: string) {
  return (await stat(path).catch(() => null)) !== null;
}

// ---------- Logging ----------

function log(message: ServerMessage) {
  const time = new Date().toLocaleTimeString();
  if (message.type === "session-removed") {
    console.log(`${time}  removed  ${message.id}`);
    return;
  }
  if (message.type !== "session-update") return;
  const { session } = message;
  const tool = session.currentTool ? `${session.currentTool.name} ${session.currentTool.target}`.trim() : "-";
  const subs = session.subagents.map((s) => `${s.name}:${s.status}`).join(", ");
  const who = IS_HUB ? `${session.machine}/${session.name}` : session.name;
  console.log(`${time}  ${who.padEnd(28)} ${session.status.padEnd(5)} ${tool}${subs ? `  [${subs}]` : ""}`);
}

// ---------- Start ----------

wss.on("listening", () => {
  console.log(`agent-factory server on ws://${HOST}:${PORT}`);
  if (IS_HUB) console.log(`hub: other machines start with HUB=ws://${hostname()}:${PORT}`);
  if (HUB_URL) console.log(`relaying to ${HUB_URL} as ${MACHINE}`);
});

// A hub-only machine never runs Claude Code, so it has no sessions folder.
// watch() throws ENOENT synchronously there, before the error handler exists.
if (await exists(SESSIONS_DIR)) {
  watch(SESSIONS_DIR, () => debounce("sessions", refreshSessions)).on("error", (error) =>
    console.error("[watch sessions]", error),
  );
} else {
  console.log(`no ${SESSIONS_DIR}, falling back to the ${CHECK_EVERY_MS / 1000} s poll`);
}

// Safety net for missed file events, dead pids, and subagent timing.
// Uses its own key so frequent session file writes can't keep postponing it.
setInterval(() => {
  debounce("check", async () => {
    tracker.tick(Date.now());
    await refreshSessions();
  });
}, CHECK_EVERY_MS);

await refreshSessions();
