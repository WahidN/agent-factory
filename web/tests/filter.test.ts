import { describe, expect, it } from "vitest";
import { EMPTY_FILTER, jumpTarget, matchesFilter, optionsFrom } from "../filter.ts";

const session = (user: string, project: string, status: "busy" | "idle") => ({ user, project, status });

describe("matchesFilter", () => {
  it("matches everything against the empty filter", () => {
    expect(matchesFilter(session("dennis", "agent-factory", "busy"), EMPTY_FILTER)).toBe(true);
  });

  it("rejects on a mismatched user", () => {
    const filter = { user: "wahid", project: null, status: null };
    expect(matchesFilter(session("dennis", "agent-factory", "busy"), filter)).toBe(false);
  });

  it("rejects on a mismatched project", () => {
    const filter = { user: null, project: "kennisbank", status: null };
    expect(matchesFilter(session("dennis", "agent-factory", "busy"), filter)).toBe(false);
  });

  it("rejects on a mismatched status", () => {
    const filter = { user: null, project: null, status: "idle" as const };
    expect(matchesFilter(session("dennis", "agent-factory", "busy"), filter)).toBe(false);
  });

  it("requires every set field to match at once", () => {
    const filter = { user: "dennis", project: "agent-factory", status: "busy" as const };
    expect(matchesFilter(session("dennis", "agent-factory", "busy"), filter)).toBe(true);
    expect(matchesFilter(session("dennis", "agent-factory", "idle"), filter)).toBe(false);
  });
});

describe("optionsFrom", () => {
  it("collects distinct, sorted users and projects", () => {
    const sessions = [
      { user: "wahid", project: "kennisbank" },
      { user: "dennis", project: "agent-factory" },
      { user: "dennis", project: "kennisbank" },
    ];
    expect(optionsFrom(sessions)).toEqual({
      users: ["dennis", "wahid"],
      projects: ["agent-factory", "kennisbank"],
    });
  });

  it("returns empty lists for no sessions", () => {
    expect(optionsFrom([])).toEqual({ users: [], projects: [] });
  });
});

describe("jumpTarget", () => {
  it("returns null when the user has no lots", () => {
    expect(jumpTarget("dennis", [])).toBeNull();
    expect(jumpTarget("dennis", [{ user: "wahid", x: 10, z: 10 }])).toBeNull();
  });

  it("averages the position of every matching lot", () => {
    const lots = [
      { user: "dennis", x: 0, z: 0 },
      { user: "dennis", x: 10, z: 20 },
      { user: "wahid", x: 100, z: 100 },
    ];
    expect(jumpTarget("dennis", lots)).toEqual({ x: 5, z: 10 });
  });

  it("returns a single lot's own position", () => {
    expect(jumpTarget("dennis", [{ user: "dennis", x: 7, z: -3 }])).toEqual({ x: 7, z: -3 });
  });
});
