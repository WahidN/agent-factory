import { describe, expect, it } from "vitest";
import type { SessionState } from "../../server/types.ts";
import { CityFeed } from "../city-feed.ts";

function session(id: string, user: string, project: string, machineTokens?: number): SessionState {
  return { id, user, project, model: "opus", status: "idle", subagents: 0, startedAt: 0, machineTokens };
}

function map(...sessions: SessionState[]): Map<string, SessionState> {
  return new Map(sessions.map((s) => [s.id, s]));
}

describe("CityFeed", () => {
  it("returns no events for the baseline observe", () => {
    const feed = new CityFeed();
    expect(feed.observe(map(session("a", "ann", "p", 60e6)))).toEqual([]);
  });

  it("treats the next observe after reset() as a baseline again", () => {
    const feed = new CityFeed();
    feed.observe(map());
    feed.reset();
    expect(feed.observe(map(session("a", "ann", "p", 60e6)))).toEqual([]);
  });

  it("fires a milestone once when the row rises", () => {
    const feed = new CityFeed();
    feed.observe(map(session("a", "ann", "p", 5e6)));
    const events = feed.observe(map(session("a", "ann", "p", 12e6)));
    expect(events).toEqual([{ kind: "milestone", user: "ann", row: 1 }]);
    expect(feed.observe(map(session("a", "ann", "p", 13e6)))).toEqual([]);
  });

  it("does not repeat a milestone when the user leaves and comes back on the same row", () => {
    const feed = new CityFeed();
    feed.observe(map(session("a", "ann", "p", 5e6)));
    feed.observe(map(session("a", "ann", "p", 12e6)));
    feed.observe(map());
    const events = feed.observe(map(session("a", "ann", "p", 12e6)));
    expect(events.filter((e) => e.kind === "milestone")).toEqual([]);
  });

  it("gives no milestone to a user who first appears after the baseline with tokens, but fires later rows", () => {
    const feed = new CityFeed();
    feed.observe(map(session("a", "ann", "p", 5e6)));
    const events = feed.observe(map(session("a", "ann", "p", 5e6), session("b", "bob", "q", 60e6)));
    expect(events).toEqual([{ kind: "session-start", user: "bob", project: "q", model: "opus" }]);
    const next = feed.observe(map(session("a", "ann", "p", 5e6), session("b", "bob", "q", 600e6)));
    expect(next.filter((e) => e.kind === "milestone")).toHaveLength(1);
  });

  it("fires one milestone for two machines under the same name", () => {
    const feed = new CityFeed();
    feed.observe(map(session("a", "ann", "p", 5e6), session("b", "ann", "p", 4e6)));
    const events = feed.observe(map(session("a", "ann", "p", 12e6), session("b", "ann", "p", 11e6)));
    expect(events.filter((e) => e.kind === "milestone")).toEqual([{ kind: "milestone", user: "ann", row: 1 }]);
  });

  it("fires session-start once per new id", () => {
    const feed = new CityFeed();
    feed.observe(map());
    const next = map(session("a", "ann", "proj"));
    expect(feed.observe(next)).toEqual([{ kind: "session-start", user: "ann", project: "proj", model: "opus" }]);
    expect(feed.observe(next)).toEqual([]);
  });

  it("fires collab-start when a project goes from one to two distinct users, users sorted", () => {
    const feed = new CityFeed();
    feed.observe(map(session("a", "zed", "proj")));
    const events = feed.observe(map(session("a", "zed", "proj"), session("b", "ann", "proj")));
    expect(events.filter((e) => e.kind === "collab-start")).toEqual([
      { kind: "collab-start", project: "proj", users: ["ann", "zed"] },
    ]);
  });

  it("does not fire collab-start again while the project stays at two or more users", () => {
    const feed = new CityFeed();
    feed.observe(map(session("a", "zed", "proj")));
    feed.observe(map(session("a", "zed", "proj"), session("b", "ann", "proj")));
    const events = feed.observe(
      map(session("a", "zed", "proj"), session("b", "ann", "proj"), session("c", "bob", "proj")),
    );
    expect(events.filter((e) => e.kind === "collab-start")).toEqual([]);
  });

  it("does not fire collab-start again when a reporter reconnect drops and restores one of the users", () => {
    const feed = new CityFeed();
    feed.observe(map(session("a", "zed", "proj")));
    feed.observe(map(session("a", "zed", "proj"), session("b", "ann", "proj")));
    // The hub drops ann's sessions when her Mac's socket dies, and re-adds them when it reconnects.
    feed.observe(map(session("a", "zed", "proj")));
    const events = feed.observe(map(session("a", "zed", "proj"), session("b", "ann", "proj")));
    expect(events.filter((e) => e.kind === "collab-start")).toEqual([]);
  });

  it("fires collab-start again when a user new to the project joins", () => {
    const feed = new CityFeed();
    feed.observe(map(session("a", "zed", "proj")));
    feed.observe(map(session("a", "zed", "proj"), session("b", "ann", "proj")));
    feed.observe(map(session("a", "zed", "proj")));
    const events = feed.observe(map(session("a", "zed", "proj"), session("c", "bob", "proj")));
    expect(events.filter((e) => e.kind === "collab-start")).toEqual([
      { kind: "collab-start", project: "proj", users: ["bob", "zed"] },
    ]);
  });
});
