import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { type WebSocket, WebSocketServer } from "ws";
import { PROTOCOL } from "../hub.ts";
import { startRelay, type Relay } from "../relay.ts";
import type { SessionState } from "../types.ts";

function session(id: string): SessionState {
  return {
    id,
    name: id,
    folder: "shop",
    machine: "mac-b",
    status: "idle",
    currentTool: null,
    startedAt: 1,
    model: "",
    subagents: [],
  };
}

// A hub stand-in on a free port. Each connection collects its parsed messages.
async function fakeHub() {
  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(wss, "listening");
  const url = `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`;
  const paths: string[] = [];
  wss.on("connection", (_socket, request) => paths.push(request.url ?? ""));
  return { wss, url, paths };
}

async function nextConnection(wss: WebSocketServer) {
  const [socket] = (await once(wss, "connection")) as [WebSocket];
  const received: unknown[] = [];
  socket.on("message", (data) => received.push(JSON.parse(data.toString())));
  return { socket, received };
}

async function until(check: () => boolean, ms = 1000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
}

let relay: Relay | undefined;
let wss: WebSocketServer | undefined;
afterEach(async () => {
  relay?.close();
  wss?.close();
});

describe("startRelay", () => {
  it("sends hello then a snapshot on connect, then forwards updates", async () => {
    const hub = await fakeHub();
    wss = hub.wss;
    const connection = nextConnection(hub.wss);
    relay = startRelay(hub.url, "mac-b", () => [session("a")], { log: () => {} });

    const { received } = await connection;
    await until(() => received.length === 2);
    expect(hub.paths).toEqual(["/relay"]);
    expect(received[0]).toEqual({ type: "hello", machine: "mac-b", protocol: PROTOCOL });
    expect(received[1]).toEqual({ type: "snapshot", sessions: [session("a")] });

    relay.send({ type: "session-removed", id: "a" });
    await until(() => received.length === 3);
    expect(received[2]).toEqual({ type: "session-removed", id: "a" });
  });

  it("reconnects after the hub closes the socket and sends a fresh snapshot", async () => {
    const hub = await fakeHub();
    wss = hub.wss;
    let sessions = [session("a")];
    const first = nextConnection(hub.wss);
    relay = startRelay(hub.url, "mac-b", () => sessions, { retryMs: 20, log: () => {} });
    const { socket, received } = await first;
    await until(() => received.length === 2);

    const second = nextConnection(hub.wss);
    sessions = [session("b")];
    socket.close();
    await once(socket, "close"); // handshake done on both ends
    relay.send({ type: "session-removed", id: "a" }); // dropped while down, never throws

    const again = await second;
    await until(() => again.received.length === 2);
    expect(again.received[0]).toEqual({ type: "hello", machine: "mac-b", protocol: PROTOCOL });
    expect(again.received[1]).toEqual({ type: "snapshot", sessions: [session("b")] });
    expect(received).toHaveLength(2);
  });

  it("keeps retrying while nothing listens, and logs the outage once", async () => {
    const hub = await fakeHub();
    const url = hub.url;
    hub.wss.close();
    await once(hub.wss, "close");

    const lines: string[] = [];
    relay = startRelay(url, "mac-b", () => [], { retryMs: 10, log: (line) => lines.push(line) });
    await new Promise((r) => setTimeout(r, 80));
    expect(lines.filter((l) => l.includes("retrying"))).toHaveLength(1);

    wss = new WebSocketServer({ host: "127.0.0.1", port: Number(new URL(url).port) });
    const { received } = await nextConnection(wss);
    await until(() => received.length === 2);
    expect(lines.at(-1)).toContain("connected");
  });
});
