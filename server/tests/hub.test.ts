import { describe, expect, it } from "vitest";
import { Hub, parseRelayMessage } from "../hub.ts";
import type { SessionState } from "../types.ts";

function session(id: string, extra: Partial<SessionState> = {}): SessionState {
  return {
    id,
    name: id,
    folder: "shop",
    machine: "",
    status: "idle",
    currentTool: null,
    startedAt: 1,
    model: "",
    subagents: [],
    ...extra,
  };
}

describe("Hub", () => {
  it("prefixes ids and stamps the machine on a session and its subagents", () => {
    const hub = new Hub();
    hub.join("mac-b");
    const { subagents: _, ...sub } = session("agent-x");
    const out = hub.apply("mac-b", { type: "session-update", session: session("s1", { subagents: [sub] }) });
    expect(out).toEqual([
      {
        type: "session-update",
        session: { ...session("s1"), id: "mac-b/s1", machine: "mac-b", subagents: [{ ...sub, machine: "mac-b" }] },
      },
    ]);
    expect(hub.remote().map((s) => s.id)).toEqual(["mac-b/s1"]);
  });

  it("a snapshot removes what the machine no longer lists", () => {
    const hub = new Hub();
    hub.join("mac-b");
    hub.apply("mac-b", { type: "snapshot", sessions: [session("a"), session("b")] });
    const out = hub.apply("mac-b", { type: "snapshot", sessions: [session("b")] });
    expect(out.map((m) => m.type)).toEqual(["session-removed", "session-update"]);
    expect(out[0]).toEqual({ type: "session-removed", id: "mac-b/a" });
    expect(hub.remote().map((s) => s.id)).toEqual(["mac-b/b"]);
  });

  it("forwards a removal with the prefixed id", () => {
    const hub = new Hub();
    hub.join("mac-b");
    hub.apply("mac-b", { type: "session-update", session: session("a") });
    expect(hub.apply("mac-b", { type: "session-removed", id: "a" })).toEqual([{ type: "session-removed", id: "mac-b/a" }]);
    expect(hub.apply("mac-b", { type: "session-removed", id: "a" })).toEqual([]);
    expect(hub.remote()).toEqual([]);
  });

  it("leave returns one removal per session and forgets the machine", () => {
    const hub = new Hub();
    hub.join("mac-b");
    hub.apply("mac-b", { type: "snapshot", sessions: [session("a"), session("b")] });
    expect(hub.leave("mac-b")).toEqual([
      { type: "session-removed", id: "mac-b/a" },
      { type: "session-removed", id: "mac-b/b" },
    ]);
    expect(hub.remote()).toEqual([]);
    expect(hub.leave("mac-b")).toEqual([]);
  });

  it("keeps two machines apart", () => {
    const hub = new Hub();
    hub.join("mac-b");
    hub.join("mac-c");
    hub.apply("mac-b", { type: "session-update", session: session("same") });
    hub.apply("mac-c", { type: "session-update", session: session("same") });
    expect(hub.remote().map((s) => [s.id, s.machine])).toEqual([
      ["mac-b/same", "mac-b"],
      ["mac-c/same", "mac-c"],
    ]);
    hub.leave("mac-b");
    expect(hub.remote().map((s) => s.id)).toEqual(["mac-c/same"]);
  });

  it("ignores a machine that did not join", () => {
    const hub = new Hub();
    expect(hub.apply("ghost", { type: "session-update", session: session("a") })).toEqual([]);
    expect(hub.remote()).toEqual([]);
  });
});

describe("parseRelayMessage", () => {
  it("accepts hello and server messages, rejects the rest", () => {
    expect(parseRelayMessage('{"type":"hello","machine":"mac-b","protocol":1}')).toEqual({ type: "hello", machine: "mac-b", protocol: 1 });
    expect(parseRelayMessage('{"type":"session-removed","id":"a"}')).toEqual({ type: "session-removed", id: "a" });
    expect(parseRelayMessage('{"type":"other"}')).toBeNull();
    expect(parseRelayMessage("not json")).toBeNull();
    expect(parseRelayMessage("42")).toBeNull();
  });
});
