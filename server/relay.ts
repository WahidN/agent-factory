// Sends our sessions to a hub on another machine. One outbound socket, an
// exponential retry with jitter, and a fresh snapshot after every connect.
// Messages sent while the socket is down are dropped: the next snapshot
// covers them.

import { WebSocket } from "ws";
import { PROTOCOL, type RelayMessage } from "./hub.ts";
import type { ServerMessage, SessionState } from "./types.ts";

export const RETRY_MS = 2000;
export const MAX_RETRY_MS = 30_000;

export type Relay = { send(message: ServerMessage): void; close(): void };

type Options = { retryMs?: number; log?: (line: string) => void; random?: () => number };

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
  const { retryMs = RETRY_MS, log = console.log, random = Math.random } = options;
  const url = new URL("/relay", hubUrl).toString();
  let socket: WebSocket | null = null;
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  let announced = false; // one log line per outage, not one per retry
  let attempt = 0;

  function connect() {
    const ws = new WebSocket(url);
    ws.on("open", () => {
      socket = ws;
      announced = false;
      attempt = 0;
      log(`relay: connected to ${url}`);
      const hello: RelayMessage = token
        ? { type: "hello", protocol: PROTOCOL, user, machine, token }
        : { type: "hello", protocol: PROTOCOL, user, machine };
      ws.send(JSON.stringify(hello));
      ws.send(JSON.stringify({ type: "snapshot", sessions: snapshot() } satisfies ServerMessage));
    });
    ws.on("error", () => {}); // a close always follows, and that is where we retry
    ws.on("close", (code, reason) => {
      if (socket === ws) socket = null;
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
      socket?.close();
    },
  };
}
