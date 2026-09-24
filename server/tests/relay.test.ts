import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { type WebSocket, WebSocketServer } from "ws";
import { PROTOCOL } from "../hub.ts";
import { backoffDelay, MAX_RETRY_MS, RETRY_MS, startRelay, type Relay } from "../relay.ts";
import type { SessionState } from "../types.ts";

function session(id: string): SessionState {
  return {
    id,
    user: "dennis",
    project: "shop",
    model: "",
    status: "idle",
    subagents: 0,
    startedAt: 1,
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
    relay = startRelay(hub.url, "mac-b", "dennis", "", () => [session("a")], { log: () => {} });

    const { received } = await connection;
    await until(() => received.length === 2);
    expect(hub.paths).toEqual(["/relay"]);
    expect(received[0]).toEqual({ type: "hello", protocol: PROTOCOL, user: "dennis", machine: "mac-b" });
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
    relay = startRelay(hub.url, "mac-b", "dennis", "", () => sessions, { retryMs: 20, log: () => {} });
    const { socket, received } = await first;
    await until(() => received.length === 2);

    const second = nextConnection(hub.wss);
    sessions = [session("b")];
    socket.close();
    await once(socket, "close"); // handshake done on both ends
    relay.send({ type: "session-removed", id: "a" }); // dropped while down, never throws

    const again = await second;
    await until(() => again.received.length === 2);
    expect(again.received[0]).toEqual({ type: "hello", protocol: PROTOCOL, user: "dennis", machine: "mac-b" });
    expect(again.received[1]).toEqual({ type: "snapshot", sessions: [session("b")] });
    expect(received).toHaveLength(2);
  });

  it("drops a hub that goes silent and reconnects", async () => {
    const hub = await fakeHub();
    wss = hub.wss;
    // This hub never pings, which is what a hub looks like from here once it is
    // gone in a way TCP does not report. The socket must not survive that.
    const connection = nextConnection(hub.wss);
    relay = startRelay(hub.url, "mac-b", "dennis", "", () => [], { retryMs: 5, silenceMs: 60, log: () => {} });
    const first = await connection;
    await until(() => first.received.length === 2);

    const closed = once(first.socket, "close");
    await until(() => hub.paths.length === 2, 3000); // the relay came back on its own
    await closed;
  });

  it("keeps a socket alive as long as the hub keeps pinging", async () => {
    const hub = await fakeHub();
    wss = hub.wss;
    const connection = nextConnection(hub.wss);
    relay = startRelay(hub.url, "mac-b", "dennis", "", () => [], { retryMs: 5, silenceMs: 100, log: () => {} });
    const { socket, received } = await connection;
    await until(() => received.length === 2);

    const ping = setInterval(() => socket.ping(), 20);
    await new Promise((r) => setTimeout(r, 300)); // three silence windows
    clearInterval(ping);
    expect(hub.paths).toHaveLength(1); // never reconnected
  });

  it("close() stops an attempt that is still connecting", async () => {
    const hub = await fakeHub();
    wss = hub.wss;
    startRelay(hub.url, "mac-b", "dennis", "", () => [], { retryMs: 5, log: () => {} }).close();
    await new Promise((r) => setTimeout(r, 200));
    expect(hub.paths).toEqual([]); // never finished the handshake, never retried
  });

  it("keeps retrying while nothing listens, and logs the outage once", async () => {
    const hub = await fakeHub();
    const url = hub.url;
    hub.wss.close();
    await once(hub.wss, "close");

    const lines: string[] = [];
    relay = startRelay(url, "mac-b", "dennis", "", () => [], { retryMs: 10, log: (line: string) => lines.push(line) });
    await new Promise((r) => setTimeout(r, 80));
    expect(lines.filter((l) => l.includes("retrying"))).toHaveLength(1);

    wss = new WebSocketServer({ host: "127.0.0.1", port: Number(new URL(url).port) });
    const { received } = await nextConnection(wss);
    await until(() => received.length === 2, 5000);
    expect(lines.at(-1)).toContain("connected");
  });

  // A hub that accepts the socket and then refuses the hello (bad token, wrong
  // protocol) still fires the open handler, so attempt/announced must not reset
  // there: a reporter a hub will never accept would otherwise retry at the base
  // delay forever instead of backing off.
  it("keeps backing off when the hub accepts the socket and then refuses it", async () => {
    const hub = await fakeHub();
    wss = hub.wss;
    const connectedAt: number[] = [];
    hub.wss.on("connection", (socket) => {
      connectedAt.push(Date.now());
      socket.close(1008, "bad token");
    });

    const lines: string[] = [];
    relay = startRelay(hub.url, "mac-b", "dennis", "bad-token", () => [], {
      retryMs: 20,
      random: () => 1, // no jitter, so delays are exactly the cap: 20, 40, 80, ...
      log: (line: string) => lines.push(line),
    });

    await until(() => connectedAt.length >= 4, 5000);
    const gaps = connectedAt.slice(1).map((t, i) => t - connectedAt[i]);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1] * 1.3);
    expect(lines.filter((l) => l.includes("retrying"))).toHaveLength(1);
  });
});

describe("backoffDelay", () => {
  it("starts at the base retry and doubles per attempt, capped at the ceiling", () => {
    const random = () => 1; // full jitter's upper edge, so the delay equals the cap exactly
    expect(backoffDelay(0, 1000, MAX_RETRY_MS, random)).toBe(1000);
    expect(backoffDelay(1, 1000, MAX_RETRY_MS, random)).toBe(2000);
    expect(backoffDelay(2, 1000, MAX_RETRY_MS, random)).toBe(4000);
  });

  it("never exceeds MAX_RETRY_MS even after many attempts", () => {
    const random = () => 1;
    expect(backoffDelay(10, 1000, MAX_RETRY_MS, random)).toBe(MAX_RETRY_MS);
    expect(backoffDelay(50, RETRY_MS, MAX_RETRY_MS, random)).toBe(MAX_RETRY_MS);
  });

  it("scales with the random draw, from 0 up to the cap", () => {
    expect(backoffDelay(0, 1000, MAX_RETRY_MS, () => 0)).toBe(0);
    expect(backoffDelay(0, 1000, MAX_RETRY_MS, () => 0.5)).toBe(500);
  });

  it("spreads real randomness so 30 reporters do not all land in the same second", () => {
    const delays = Array.from({ length: 30 }, () => backoffDelay(0, RETRY_MS, MAX_RETRY_MS, Math.random));
    const seconds = new Set(delays.map((d) => Math.floor(d / 1000)));
    expect(seconds.size).toBeGreaterThan(1);
  });
});
