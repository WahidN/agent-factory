// Sends our sessions to a hub on another machine. One outbound socket, an
// exponential retry with jitter, and a fresh snapshot after every connect.
// Messages sent while the socket is down are dropped: the next snapshot
// covers them.

import { WebSocket } from "ws";
import { PROTOCOL, type RelayMessage } from "./hub.ts";
import type { ServerMessage, SessionState } from "./types.ts";

export const RETRY_MS = 2000;
export const MAX_RETRY_MS = 30_000;

// The hub pings every connected socket every 30 seconds and `ws` answers those
// by itself, which is how the hub spots a dead reporter. The reporter needs
// the same check the other way round: a hub that vanishes without a close
// frame (an unplugged Pi, a switch that drops the LAN for a minute) leaves
// this socket open as far as TCP is concerned. After three missed hub pings
// the reporter drops the socket itself, which lands in the close handler below
// and reconnects with the usual backoff.
export const SILENCE_MS = 90_000;

export type Relay = { send(message: ServerMessage): void; close(): void };

type Options = { retryMs?: number; silenceMs?: number; log?: (line: string) => void; random?: () => number };

// Full jitter: a delay picked uniformly between 0 and the exponentially
// growing cap for this attempt (0-indexed, reset to 0 after a successful
// connect). Real randomness matters here: thirty reporters that lost their
// hub at the same moment must not all retry in lockstep, or the hub gets hit
// by the same wave again the moment it comes back.
export function backoffDelay(attempt: number, retryMs: number, maxRetryMs: number, random: () => number): number {
  const cap = Math.min(maxRetryMs, retryMs * 2 ** attempt);
  return random() * cap;
}

export function startRelay(
  hubUrl: string,
  machine: string,
  user: string,
  token: string,
  snapshot: () => SessionState[],
  options: Options = {},
): Relay {
  const { retryMs = RETRY_MS, silenceMs = SILENCE_MS, log = console.log, random = Math.random } = options;
  const url = new URL("/relay", hubUrl).toString();
  let socket: WebSocket | null = null;
  // The socket of the current attempt, open or not. `socket` only holds it once
  // it opened, so without this a close() lands on nothing while a connect is in
  // flight, and that attempt goes on to open and set a silence timer nobody
  // clears.
  let pending: WebSocket | null = null;
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  let announced = false; // one log line per outage, not one per retry
  let attempt = 0;

  function connect() {
    const ws = new WebSocket(url);
    pending = ws;
    let silence: NodeJS.Timeout | undefined;
    // The hub's ping is the only thing that ever arrives here: a reporter sends
    // no pings of its own, so no pong comes back, and the hub keeps its
    // broadcasts to the browser sockets.
    const heard = () => {
      clearTimeout(silence);
      silence = setTimeout(() => ws.terminate(), silenceMs);
    };
    ws.on("ping", heard);
    ws.on("open", () => {
      socket = ws;
      announced = false;
      attempt = 0;
      heard();
      log(`relay: connected to ${url}`);
      const hello: RelayMessage = token
        ? { type: "hello", protocol: PROTOCOL, user, machine, token }
        : { type: "hello", protocol: PROTOCOL, user, machine };
      ws.send(JSON.stringify(hello));
      ws.send(JSON.stringify({ type: "snapshot", sessions: snapshot() } satisfies ServerMessage));
    });
    ws.on("error", () => {}); // a close always follows, and that is where we retry
    ws.on("close", (code, reason) => {
      clearTimeout(silence);
      if (socket === ws) socket = null;
      if (pending === ws) pending = null;
      if (stopped) return;
      const wait = backoffDelay(attempt, retryMs, MAX_RETRY_MS, random);
      attempt++;
      if (!announced) {
        announced = true;
        const why = reason.length ? ` ${reason.toString()}` : "";
        log(`relay: hub gone (${code}${why}), retrying up to every ${MAX_RETRY_MS / 1000} s`);
      }
      timer = setTimeout(connect, wait);
    });
  }

  connect();
  return {
    send(message) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    },
    close() {
      stopped = true;
      clearTimeout(timer);
      if (socket) socket.close();
      else pending?.terminate();
    },
  };
}
