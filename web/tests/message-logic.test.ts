import { describe, expect, it } from "vitest";
import type { PlainMessage, ServerMessage } from "../../server/types.ts";
import { flattenBatch } from "../message-logic.ts";

function update(id: string): PlainMessage {
  return {
    type: "session-update",
    session: { id, user: "dennis", project: "shop", model: "", status: "idle", subagents: 0, startedAt: 1 },
  };
}

describe("flattenBatch", () => {
  it("wraps a lone message in a list of one, so it behaves exactly as before", () => {
    const message: ServerMessage = update("a");
    expect(flattenBatch(message)).toEqual([update("a")]);
  });

  it("unwraps a batch into the plain messages it carries", () => {
    const message: ServerMessage = { type: "batch", messages: [update("a"), { type: "session-removed", id: "b" }] };
    expect(flattenBatch(message)).toEqual([update("a"), { type: "session-removed", id: "b" }]);
  });

  it("a batch never contains a batch", () => {
    const message: ServerMessage = { type: "batch", messages: [update("a"), update("b")] };
    for (const plain of flattenBatch(message)) {
      expect(plain.type).not.toBe("batch");
    }
  });
});
