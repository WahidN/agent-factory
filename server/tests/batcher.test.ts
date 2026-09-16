import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBatcher } from "../batcher.ts";
import type { PlainMessage, ServerMessage } from "../types.ts";

function update(id: string): PlainMessage {
  return {
    type: "session-update",
    session: { id, user: "dennis", project: "shop", model: "", status: "idle", subagents: 0, startedAt: 1 },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createBatcher", () => {
  it("sends nothing when a tick passes without any push", () => {
    const sent: ServerMessage[] = [];
    createBatcher((message) => sent.push(message));
    vi.runAllTimers();
    expect(sent).toEqual([]);
  });

  it("sends N updates from the same tick as exactly one batch", () => {
    const sent: ServerMessage[] = [];
    const batcher = createBatcher((message) => sent.push(message));
    batcher.push(update("a"));
    batcher.push(update("b"));
    batcher.push(update("c"));
    vi.runAllTimers();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({ type: "batch", messages: [update("a"), update("b"), update("c")] });
  });

  it("never nests a batch inside a batch", () => {
    const sent: ServerMessage[] = [];
    const batcher = createBatcher((message) => sent.push(message));
    batcher.push(update("a"));
    vi.runAllTimers();
    expect(sent[0]).toMatchObject({ type: "batch" });
    for (const message of (sent[0] as { messages: PlainMessage[] }).messages) {
      expect(message.type).not.toBe("batch");
    }
  });

  it("starts a fresh batch for the next tick", () => {
    const sent: ServerMessage[] = [];
    const batcher = createBatcher((message) => sent.push(message));
    batcher.push(update("a"));
    vi.runAllTimers();
    batcher.push(update("b"));
    vi.runAllTimers();
    expect(sent).toEqual([
      { type: "batch", messages: [update("a")] },
      { type: "batch", messages: [update("b")] },
    ]);
  });
});
