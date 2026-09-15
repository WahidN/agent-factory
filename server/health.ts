// Pure health check: no sockets, no clock, no filesystem. Takes a snapshot of
// state and a timestamp, returns a verdict. Kept pure so the rules can be
// tested without spinning up a server.

import type { Mode } from "./config.ts";

export type HealthInput = {
  mode: Mode;
  /** Number of connected reporters (relay sockets), central mode only. */
  reporters: number;
  /** ms-timestamp of the last session update, 0 = never. */
  lastUpdateAt: number;
  now: number;
};

export type Health = {
  ok: boolean;
  status: number;
  body: {
    ok: boolean;
    mode: Mode;
    reporters: number;
    lastUpdateAgeMs: number | null;
  };
};

// A central with sockets open but nothing coming in for this long is stuck,
// not idle.
export const STALE_MS = 120_000;

export function health(input: HealthInput): Health {
  const { mode, reporters, lastUpdateAt, now } = input;
  const lastUpdateAgeMs = lastUpdateAt > 0 ? now - lastUpdateAt : null;

  let ok = true;
  if (mode === "central") {
    // No reporters at all: a central without anyone reporting to it is
    // broken, even though the process itself is up.
    if (reporters === 0) ok = false;
    // Reporters connected but nothing has arrived in a while: the sockets
    // are open but the pipeline is dead.
    else if (lastUpdateAgeMs !== null && lastUpdateAgeMs > STALE_MS) ok = false;
  }

  return {
    ok,
    status: ok ? 200 : 503,
    body: { ok, mode, reporters, lastUpdateAgeMs },
  };
}
