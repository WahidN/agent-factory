// index.ts is glue with side effects at import time (see vite.config.ts), so
// the token guard rail it wires up is exercised here by running the real
// central process instead of importing the module in-process.

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { PROTOCOL } from "../hub.ts";

let child: ChildProcessWithoutNullStreams | undefined;

afterEach(() => {
  child?.kill();
  child = undefined;
});

function nextPort() {
  return 39000 + Math.floor(Math.random() * 5000);
}

function startCentral(port: number, token: string, home?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    child = spawn("node", ["--import", "tsx", "server/index.ts", "--hub"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        MACHINE: "test-hub",
        USER: "tester",
        FACTORY_TOKEN: token,
        ...(home ? { HOME: home } : {}),
      },
    });
    const timeout = setTimeout(() => reject(new Error("central did not start in time")), 10_000);
    child.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("websocket on /ws")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      // Surface unexpected crashes instead of hanging until the timeout.
      const text = chunk.toString();
      if (text.trim()) console.error(text);
    });
    child.on("error", reject);
  });
}

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/relay`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

describe("central token guard rail", () => {
  it("closes the connection on a token mismatch", async () => {
    const port = nextPort();
    await startCentral(port, "secret");
    const ws = await connect(port);
    const closed = new Promise<number>((resolve) => ws.on("close", (code) => resolve(code)));
    ws.send(JSON.stringify({ type: "hello", protocol: PROTOCOL, user: "someone", machine: "spy", token: "wrong" }));
    expect(await closed).toBe(1008);
  }, 15_000);

  it("accepts a reporter with the right token", async () => {
    const port = nextPort();
    await startCentral(port, "secret");
    const ws = await connect(port);
    const closedEarly: number[] = [];
    ws.on("close", (code) => closedEarly.push(code));
    ws.send(JSON.stringify({ type: "hello", protocol: PROTOCOL, user: "someone", machine: "spy", token: "secret" }));
    ws.send(JSON.stringify({ type: "snapshot", sessions: [] }));
    await new Promise((r) => setTimeout(r, 300));
    expect(closedEarly).toEqual([]);
    ws.close();
  }, 15_000);

  it("accepts every token when the central has none configured", async () => {
    const port = nextPort();
    await startCentral(port, "");
    const ws = await connect(port);
    const closedEarly: number[] = [];
    ws.on("close", (code) => closedEarly.push(code));
    ws.send(JSON.stringify({ type: "hello", protocol: PROTOCOL, user: "someone", machine: "spy", token: "whatever" }));
    await new Promise((r) => setTimeout(r, 300));
    expect(closedEarly).toEqual([]);
    ws.close();
  }, 15_000);
});

// The Pi runs the central and nothing else, so it has no Claude Code and no
// ~/.claude at all. fs.watch throws synchronously on a missing folder, which
// took the whole process down before it ever listened.
describe("a machine with no ~/.claude", () => {
  it("still starts and serves", async () => {
    const home = await mkdtemp(join(tmpdir(), "agent-factory-empty-home-"));
    const port = nextPort();
    await startCentral(port, "", home);
    const response = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(response.status).toBe(503); // central, no reporters yet
    await rm(home, { recursive: true, force: true });
  }, 15_000);
});
