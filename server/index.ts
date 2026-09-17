// Glue: watches Claude Code files, feeds the tracker, streams state over
// WebSocket, and (unless in reporter mode) serves the built page. One
// process, one port.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { watch, type FSWatcher } from "node:fs";
import { open, readdir, readFile, stat } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { basename, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import { createBatcher } from "./batcher.ts";
import {
  dropPartialFirstLine,
  parseSessionFile,
  parseSubagentMeta,
  parseTranscriptChunk,
  projectDirFor,
  type SessionFile,
  type TranscriptEvent,
} from "./claude-reader.ts";
import { ConfigError, loadConfig } from "./config.ts";
import { health } from "./health.ts";
import { createHeartbeat } from "./heartbeat.ts";
import { Hub, MIN_PROTOCOL, parseRelayMessage, PROTOCOL, protocolSupported } from "./hub.ts";
import { createMetrics } from "./metrics.ts";
import { startRelay } from "./relay.ts";
import { SessionTracker, SUBAGENT_REMOVE_MS } from "./session-tracker.ts";
import type { PlainMessage, ServerMessage } from "./types.ts";

const rootDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

let config: ReturnType<typeof loadConfig>;
try {
  config = loadConfig({ env: process.env, argv: process.argv, rootDir });
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const IS_HUB = config.mode === "central";
const HUB_URL = config.hubUrl;
const HOST = config.host;
const PORT = config.port;
const MACHINE = config.machine;
const CLAUDE_DIR = join(homedir(), ".claude");
const SESSIONS_DIR = join(CLAUDE_DIR, "sessions");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");
const TAIL_BYTES = 64 * 1024;
const DEBOUNCE_MS = 50;
const CHECK_EVERY_MS = 5_000;

// ---------- HTTP + WebSocket, one server, one port ----------

const httpServer = createServer(handleRequest);
const wss = new WebSocketServer({ noServer: true });

// Every connected socket, browsers on /ws and reporters on /relay alike, is
// pinged every HEARTBEAT_MS. A socket that misses two pings in a row is
// terminated (not closed: a half dead socket never answers a close either).
export const HEARTBEAT_MS = 30_000;
const heartbeat = createHeartbeat<WebSocket>();

setInterval(() => {
  for (const dead of heartbeat.onTick()) dead.terminate();
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.ping();
  }
}, HEARTBEAT_MS);

let lastUpdateAt = 0;

function sendToBrowsers(message: ServerMessage) {
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

// Messages that land in the same tick go out as one "batch", so a snapshot
// of 150 sessions is one send instead of 150.
const batcher = createBatcher(sendToBrowsers);

function broadcast(message: PlainMessage) {
  if (message.type === "session-update") lastUpdateAt = Date.now();
  batcher.push(message);
}

const tracker = new SessionTracker((message) => {
  log(message);
  broadcast(message);
  relay?.send(message);
}, config.user);

const relay = HUB_URL
  ? startRelay(HUB_URL, MACHINE, config.user, config.token, () => tracker.snapshot(Date.now()))
  : null;

// Browsers connect on /ws and get our sessions plus everything relayed to us.
// Other machines connect on /relay, central mode only.
const hub = new Hub();
const reporters = new Map<string, WebSocket>(); // machine -> its open relay socket
const metrics = createMetrics();

// The upgrade handler routes on the path with any query string stripped, and
// the connection handler below has to read it back the same way: matching on
// the raw url there would route `/relay?x=1` into the browser branch, where a
// reporter never joins the hub and its machine silently never shows up.
const socketPath = (request: IncomingMessage) => request.url?.split("?")[0] ?? "";

httpServer.on("upgrade", (request, socket, head) => {
  const path = socketPath(request);
  if (path === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
    return;
  }
  if (path === "/relay") {
    if (!IS_HUB) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
    return;
  }
  socket.destroy();
});

wss.on("connection", (socket, request) => {
  heartbeat.onConnect(socket);
  socket.on("pong", () => heartbeat.onPong(socket));
  socket.on("close", () => heartbeat.forget(socket));

  if (socketPath(request) === "/relay") {
    acceptReporter(socket, request.socket.remoteAddress ?? "?");
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
      if (!protocolSupported(message.protocol)) {
        const time = new Date().toLocaleTimeString();
        console.log(
          `${time}  refused  ${message.machine}: protocol ${message.protocol}, this hub accepts ${MIN_PROTOCOL}-${PROTOCOL}`,
        );
        return socket.close(1002, `protocol ${MIN_PROTOCOL}-${PROTOCOL} expected`);
      }
      // A guard rail against a misdirected reporter, not authentication: no
      // timing safe compare, and a hub with no token configured accepts
      // everyone.
      if (config.token && message.token !== config.token) {
        console.log(`${new Date().toLocaleTimeString()}  refused  ${message.machine}: bad token`);
        return socket.close(1008, "bad token");
      }
      machine = message.machine;
      // A machine that restarted before its old socket was seen dead takes over its own sessions.
      const old = reporters.get(machine);
      reporters.set(machine, socket);
      old?.terminate();
      hub.join(machine);
      metrics.join(machine, message.protocol, Date.now());
      console.log(
        `${new Date().toLocaleTimeString()}  joined   ${machine} (protocol ${message.protocol}) from ${from}`,
      );
      return;
    }
    if (!message || message.type === "hello") return;
    metrics.message(machine, Date.now());
    for (const out of hub.apply(machine, message)) {
      log(out);
      broadcast(out);
    }
  });
  socket.on("close", () => {
    if (!machine || reporters.get(machine) !== socket) return; // replaced by a newer socket
    reporters.delete(machine);
    metrics.leave(machine);
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
  readQueues.set(
    path,
    read.catch(() => {}),
  );
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
  if (result) tracker.applySessionEvents(sessionId, result.events, result.mtimeMs, Date.now());
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

// ---------- HTTP: static page + healthz ----------

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const BUILD_MISSING_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>agent-factory</title></head>
<body><h1>Not built yet</h1><p>Run <code>pnpm build</code> to produce web/dist, then restart the server.</p></body>
</html>`;

async function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const path = (request.url ?? "/").split("?")[0];

  if (path === "/healthz") {
    const result = health({ mode: config.mode, reporters: reporters.size, lastUpdateAt, now: Date.now() });
    response.writeHead(result.status, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(result.body));
    return;
  }

  if (path === "/metrics") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(metrics.snapshot(Date.now())));
    return;
  }

  if (!config.serveWeb) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
    return;
  }

  await serveStatic(path, request.method, response);
}

async function serveStatic(urlPath: string, method: string | undefined, response: ServerResponse) {
  // Decode first: without this a file whose name holds a space or an accent is
  // never found, and percent escapes would be the only thing standing between a
  // request and a traversal. The check below is what actually stops traversal,
  // so decoding costs nothing.
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(method === "HEAD" ? undefined : "Bad request");
    return;
  }

  const relative = decoded === "/" ? "index.html" : decoded.slice(1);
  // Normalize and resolve against webRoot, then check the result is still
  // inside webRoot. This is what stops "/../../etc/passwd" and an absolute
  // path from ever reading a file outside the built page.
  const requested = resolve(config.webRoot, normalize(relative));
  const withinRoot = requested === config.webRoot || requested.startsWith(config.webRoot + sep);
  if (!withinRoot) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const info = await stat(requested).catch(() => null);
  if (!info?.isFile()) {
    if (await isBuildMissing()) {
      response.writeHead(503, { "Content-Type": "text/html; charset=utf-8" });
      response.end(method === "HEAD" ? undefined : BUILD_MISSING_HTML);
      return;
    }
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(method === "HEAD" ? undefined : "Not found");
    return;
  }

  const contentType = CONTENT_TYPES[extname(requested)] ?? "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  if (method === "HEAD") {
    response.end();
    return;
  }
  response.end(await readFile(requested));
}

async function isBuildMissing(): Promise<boolean> {
  const info = await stat(config.webRoot).catch(() => null);
  return !info;
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
  const who = `${session.user}/${session.project}`;
  console.log(`${time}  ${who.padEnd(28)} ${session.status.padEnd(5)} subagents=${session.subagents}`);
}

// ---------- Start ----------

// A reporter claims no port at all: it only opens one outbound connection to
// the hub, so it never collides with another process (or another reporter)
// on the same machine. There is no local /healthz or /metrics in this mode,
// the hub's copies of those are the ones that matter.
if (config.mode === "reporter") {
  console.log(`agent-factory reporter as ${MACHINE}: no local server, no port, relaying to ${HUB_URL}`);
} else {
  httpServer.listen(PORT, HOST, () => {
    console.log(`agent-factory server on http://${HOST}:${PORT}, websocket on /ws`);
    if (IS_HUB) console.log(`hub: other machines start with HUB=ws://${hostname()}:${PORT}`);
  });
}

// fs.watch throws synchronously when the folder is missing, so the error
// handler below never gets a chance and an uncaught ENOENT would take the
// whole process down at startup. A central on a Pi has no Claude Code
// installed and therefore no ~/.claude/sessions at all, which is exactly the
// machine this has to survive. Without the watcher the five second check
// below still picks sessions up, and it retries the watch once the folder
// appears.
let sessionsWatcher: FSWatcher | null = null;

function watchSessionsDir() {
  if (sessionsWatcher) return;
  try {
    sessionsWatcher = watch(SESSIONS_DIR, () => debounce("sessions", refreshSessions));
    sessionsWatcher.on("error", (error) => {
      console.error("[watch sessions]", error);
      sessionsWatcher?.close();
      sessionsWatcher = null;
    });
  } catch {
    sessionsWatcher = null; // no sessions folder yet, the periodic check covers it
  }
}

watchSessionsDir();

// Safety net for missed file events, dead pids, and subagent timing.
// Uses its own key so frequent session file writes can't keep postponing it.
setInterval(() => {
  debounce("check", async () => {
    watchSessionsDir(); // cheap no-op once the watcher is up
    tracker.tick(Date.now());
    await refreshSessions();
  });
}, CHECK_EVERY_MS);

await refreshSessions();
