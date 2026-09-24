// Body of /healthz, which always answers 200 while the process serves. It
// reports facts and leaves the verdict to the caller: `reporters` counts live
// relay sockets (the heartbeat terminates dead ones), and `lastUpdateAgeMs`
// only moves when a session changes, so a quiet park and a stuck one look the
// same from here.

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
  mode: Mode;
  reporters: number;
  lastUpdateAgeMs: number | null;
};

export function health({ mode, reporters, lastUpdateAt, now }: HealthInput): Health {
  return { mode, reporters, lastUpdateAgeMs: lastUpdateAt > 0 ? now - lastUpdateAt : null };
}
