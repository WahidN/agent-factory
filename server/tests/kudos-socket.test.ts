// Runs the real central, like index-token.test.ts: index.ts is glue with side
// effects at import time. The known user comes from a reporter on /relay.

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { PROTOCOL } from "../hub.ts";
import { freePort } from "./free-port.ts";

let child: ChildProcessWithoutNullStreams | undefined;

afterEach(() => {
  child?.kill();
  child = undefined;
});

function startCentral(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    child = spawn("node", ["--import", "tsx", "server/index.ts", "--hub"], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port), MACHINE: "test-hub", USER: "tester", FACTORY_TOKEN: "", HUB: "" },
    });
    const timeout = setTimeout(() => reject(new Error("central did not start in time")), 10_000);
    child.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("websocket on /ws")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on("error", reject);
  });
}

const open = (url: string) =>
  new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(condition: () => boolean, ms = 5_000) {
  const end = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > end) throw new Error("condition not met in time");
    await wait(20);
  }
}

type Received = { type: string; user?: string };

// Resolves once the browser has its snapshot, so it is registered for broadcasts.
async function browser(port: number) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const received: Received[] = [];
  const raw: string[] = [];
  ws.on("message", (data) => {
    raw.push(data.toString());
    received.push(JSON.parse(data.toString()));
  });
  ws.on("error", () => {}); // a test that expects a close must not fail on its error
  await until(() => received.some((m) => m.type === "snapshot"));
  return { ws, received, raw };
}

// The browser has been told about a session of this user (in its snapshot or
// an update), which means the central knows it.
const knows = (b: { raw: string[] }, user: string) =>
  b.raw.some((text) => !text.includes('"type":"kudos"') && text.includes(`"user":"${user}"`));

async function reporterWith(port: number, user: string) {
  const ws = await open(`ws://127.0.0.1:${port}/relay`);
  ws.send(JSON.stringify({ type: "hello", protocol: PROTOCOL, user, machine: "mac" }));
  ws.send(
    JSON.stringify({
      type: "session-update",
      session: { id: "s1", user, project: "shop", model: "", status: "idle", subagents: 0, startedAt: 1 },
    }),
  );
  return ws;
}

const closeCode = (ws: WebSocket) => new Promise<number>((resolve) => ws.on("close", (code) => resolve(code)));

describe("kudos from a browser", () => {
  it("reaches every browser when the user has a session", async () => {
    const port = await freePort();
    await startCentral(port);
    const reporter = await reporterWith(port, "dennis");
    const sender = await browser(port);
    const other = await browser(port);
    await until(() => knows(other, "dennis"));
    sender.ws.send(JSON.stringify({ type: "kudos", user: "dennis" }));
    await until(() => other.received.some((m) => m.type === "kudos"));
    expect(other.received).toContainEqual({ type: "kudos", user: "dennis" });
    reporter.close();
    sender.ws.close();
    other.ws.close();
  }, 15_000);

  it("is ignored quietly for a user without a session", async () => {
    const port = await freePort();
    await startCentral(port);
    const sender = await browser(port);
    const other = await browser(port);
    const closed: number[] = [];
    sender.ws.on("close", (code) => closed.push(code));
    sender.ws.send(JSON.stringify({ type: "kudos", user: "nobody" }));
    await wait(300);
    expect(other.received.some((m) => m.type === "kudos")).toBe(false);
    expect(closed).toEqual([]);
    sender.ws.close();
    other.ws.close();
  }, 15_000);

  it("is sent on once per 2 seconds per socket, without closing the sender", async () => {
    const port = await freePort();
    await startCentral(port);
    const reporter = await reporterWith(port, "dennis");
    const sender = await browser(port);
    const other = await browser(port);
    await until(() => knows(other, "dennis"));
    const closed: number[] = [];
    sender.ws.on("close", (code) => closed.push(code));
    for (let i = 0; i < 3; i++) sender.ws.send(JSON.stringify({ type: "kudos", user: "dennis" }));
    await until(() => other.received.some((m) => m.type === "kudos"));
    await wait(300);
    expect(other.received.filter((m) => m.type === "kudos")).toHaveLength(1);
    expect(closed).toEqual([]);
    expect(sender.ws.readyState).toBe(WebSocket.OPEN);
    reporter.close();
    sender.ws.close();
    other.ws.close();
  }, 15_000);

  it("closes the socket with 1008 on an invalid message", async () => {
    const port = await freePort();
    await startCentral(port);
    const sender = await browser(port);
    const closed = closeCode(sender.ws);
    sender.ws.send("not json");
    expect(await closed).toBe(1008);
  }, 15_000);

  it("closes the socket with 1008 on a binary frame", async () => {
    const port = await freePort();
    await startCentral(port);
    const sender = await browser(port);
    const closed = closeCode(sender.ws);
    sender.ws.send(Buffer.from(JSON.stringify({ type: "kudos", user: "dennis" })), { binary: true });
    expect(await closed).toBe(1008);
  }, 15_000);

  it("closes the socket on a 2 KB frame and keeps serving other browsers", async () => {
    const port = await freePort();
    await startCentral(port);
    const sender = await browser(port);
    const bystander = await browser(port);
    const closed = closeCode(sender.ws);
    sender.ws.send("x".repeat(2048));
    expect(await closed).toBe(1009);
    expect(bystander.ws.readyState).toBe(WebSocket.OPEN);
    const fresh = await browser(port); // a new browser still gets its snapshot
    expect(fresh.received.some((m) => m.type === "snapshot")).toBe(true);
    bystander.ws.close();
    fresh.ws.close();
  }, 15_000);
});
