// Sends our sessions to a hub on another machine. One outbound socket, the
// page's 2 second retry, and a fresh snapshot after every connect. Messages
// sent while the socket is down are dropped: the next snapshot covers them.

import { WebSocket } from "ws";
import { PROTOCOL, type RelayMessage } from "./hub.ts";
import type { ServerMessage, SessionState } from "./types.ts";

export const RETRY_MS = 2000;

export type Relay = { send(message: ServerMessage): void; close(): void };

type Options = { retryMs?: number; log?: (line: string) => void };

export function startRelay(hubUrl: string, machine: string, snapshot: () => SessionState[], options: Options = {}): Relay {
  const { retryMs = RETRY_MS, log = console.log } = options;
  const url = new URL("/relay", hubUrl).toString();
  let socket: WebSocket | null = null;
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  let announced = false; // one log line per outage, not one per retry

  function connect() {
    const ws = new WebSocket(url);
    ws.on("open", () => {
      socket = ws;
      announced = false;
      log(`relay: connected to ${url}`);
      ws.send(JSON.stringify({ type: "hello", machine, protocol: PROTOCOL } satisfies RelayMessage));
      ws.send(JSON.stringify({ type: "snapshot", sessions: snapshot() } satisfies ServerMessage));
    });
    ws.on("error", () => {}); // a close always follows, and that is where we retry
    ws.on("close", (code, reason) => {
      if (socket === ws) socket = null;
      if (stopped) return;
      if (!announced) {
        announced = true;
        const why = reason.length ? ` ${reason.toString()}` : "";
        log(`relay: hub gone (${code}${why}), retrying every ${retryMs / 1000} s`);
      }
      timer = setTimeout(connect, retryMs);
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
