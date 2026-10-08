// Validation for what a browser may send on /ws. Pure: no sockets, and the
// clock is injected. A browser only ever sends one thing, a kudos for a user.

import type { ViewerMessage } from "./types.ts";

export const MAX_VIEWER_BYTES = 256;
export const MAX_USER_CHARS = 64;
export const KUDOS_EVERY_MS = 2_000;

// Null for anything that is not exactly {type: "kudos", user}. The caller
// closes the socket on null: a page never sends this by accident.
export function parseViewerMessage(raw: string): ViewerMessage | null {
  if (Buffer.byteLength(raw) > MAX_VIEWER_BYTES) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const keys = Object.keys(data);
  if (keys.length !== 2 || !keys.includes("type") || !keys.includes("user")) return null;
  const { type, user } = data as Record<string, unknown>;
  if (type !== "kudos") return null;
  if (typeof user !== "string" || user === "" || user.length > MAX_USER_CHARS) return null;
  return { type: "kudos", user };
}

// One per socket. Returns whether this kudos may go out; a refused one does
// not move the window.
export function createKudosLimiter(now: () => number = Date.now): () => boolean {
  let last = Number.NEGATIVE_INFINITY;
  return () => {
    const t = now();
    if (t - last < KUDOS_EVERY_MS) return false;
    last = t;
    return true;
  };
}
