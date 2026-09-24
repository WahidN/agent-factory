// Pure helper for handling a batch of updates as one park refresh instead of
// one per message. No DOM or scene here, so it can be tested without either.

import type { ParkMessage, PlainMessage } from "../server/types.ts";

// Unwraps a batch into the plain messages it carries. A lone message becomes
// a list of one, so callers handle every message the same way.
export function flattenBatch(message: ParkMessage): PlainMessage[] {
  return message.type === "batch" ? message.messages : [message];
}
