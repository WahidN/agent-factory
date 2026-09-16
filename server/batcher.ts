// Coalesces the messages that arrive in one tick into a single "batch" sent
// to browsers, instead of one message per session. A snapshot of 150 sessions
// used to arrive as 150 separate messages, and the page rebuilt every road,
// kerb, lamp and tree of the park after each one.

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
