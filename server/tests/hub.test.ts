import { describe, expect, it } from "vitest";
import { Hub, MIN_PROTOCOL, parseRelayMessage, PROTOCOL, protocolSupported } from "../hub.ts";
import type { SessionState } from "../types.ts";

function session(id: string, extra: Partial<SessionState> = {}): SessionState {
  return {
    id,
    user: "dennis",
    project: "shop",
    model: "",
    status: "idle",
    subagents: 0,
    startedAt: 1,
    ...extra,
  };
}

describe("Hub", () => {
  it("prefixes ids but does not stamp a machine on the state", () => {
    const hub = new Hub();
    hub.join("mac-b");
    const out = hub.apply("mac-b", { type: "session-update", session: session("s1") });
    expect(out).toEqual([{ type: "session-update", session: { ...session("s1"), id: "mac-b/s1" } }]);
    expect(out[0]).toMatchObject({ session: expect.not.objectContaining({ machine: expect.anything() }) });
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
    expect(hub.apply("mac-b", { type: "session-removed", id: "a" })).toEqual([
      { type: "session-removed", id: "mac-b/a" },
    ]);
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
    expect(hub.remote().map((s) => s.id)).toEqual(["mac-b/same", "mac-c/same"]);
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
    expect(parseRelayMessage('{"type":"hello","protocol":2,"user":"dennis","machine":"mac-b"}')).toEqual({
      type: "hello",
      protocol: 2,
      user: "dennis",
      machine: "mac-b",
    });
    expect(parseRelayMessage('{"type":"session-removed","id":"a"}')).toEqual({ type: "session-removed", id: "a" });
    expect(parseRelayMessage('{"type":"other"}')).toBeNull();
    expect(parseRelayMessage("not json")).toBeNull();
    expect(parseRelayMessage("42")).toBeNull();
  });
});

describe("PROTOCOL", () => {
  it("is bumped to 2 for the flat wire format", () => {
    expect(PROTOCOL).toBe(2);
  });
});

describe("protocolSupported", () => {
  it("accepts anything in [MIN_PROTOCOL, PROTOCOL]", () => {
    expect(protocolSupported(MIN_PROTOCOL)).toBe(true);
    expect(protocolSupported(PROTOCOL)).toBe(true);
  });

  it("rejects below MIN_PROTOCOL and above PROTOCOL", () => {
    expect(protocolSupported(MIN_PROTOCOL - 1)).toBe(false);
    expect(protocolSupported(PROTOCOL + 1)).toBe(false);
  });
});
