// Coalesces the messages that arrive in one tick into a single "batch" sent
// to browsers, instead of one message per session, so the page rebuilds the
// park once per tick and not once per session.

import type { PlainMessage, ServerMessage } from "./types.ts";

export type Batcher = { push(message: PlainMessage): void };

export function createBatcher(
  send: (message: ServerMessage) => void,
  schedule: (task: () => void) => void = (task) => setTimeout(task, 0),
): Batcher {
  let queue: PlainMessage[] = [];
  let flushScheduled = false;

  function flush() {
    flushScheduled = false;
    if (queue.length === 0) return;
    const messages = queue;
    queue = [];
    send({ type: "batch", messages });
  }

  return {
    push(message) {
      queue.push(message);
      if (flushScheduled) return;
      flushScheduled = true;
      schedule(flush);
    },
  };
}
