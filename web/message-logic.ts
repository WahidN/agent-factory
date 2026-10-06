// Pure helper for handling a batch of updates as one park refresh instead of
// one per message. No DOM or scene here, so it can be tested without either.

import type { ParkMessage, PlainMessage, ServerMessage } from "../server/types.ts";

const SERVER_TYPES = new Set(["snapshot", "session-update", "session-removed", "batch", "server-mode", "kudos"]);

// Parses one socket frame. Null for broken JSON or a type this page does not
// know, so a newer server's message is skipped instead of read as a removal.
// Only the type is checked: the server is ours and validates what it sends.
export function parseServerMessage(raw: string): ServerMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { type } = data as { type?: unknown };
  return typeof type === "string" && SERVER_TYPES.has(type) ? (data as ServerMessage) : null;
}

// Unwraps a batch into the plain messages it carries. A lone message becomes
// a list of one, so callers handle every message the same way.
export function flattenBatch(message: ParkMessage): PlainMessage[] {
  return message.type === "batch" ? message.messages : [message];
}
