import { describe, expect, it } from "vitest";
import type { SessionState } from "../../server/types.ts";
import { demoEvent } from "../demo-events.ts";
import { MILESTONES } from "../milestone-ladder.ts";

function session(id: string, user: string, project: string, machineTokens?: number): SessionState {
  return { id, user, project, model: "opus", status: "idle", subagents: 0, startedAt: 0, machineTokens };
}

const sessions = [session("a", "ann", "alpha", 30e6), session("c", "cy", "alpha", 0)];
const firstFour = (list: readonly SessionState[]) => [0, 1, 2, 3].map((step) => demoEvent(list, step));

describe("demoEvent", () => {
  it("returns null without sessions", () => {
    expect(demoEvent([], 0)).toBeNull();
  });

  it("rotates over the four kinds and then repeats", () => {
    const kinds = [0, 1, 2, 3, 4].map((step) => demoEvent(sessions, step)?.kind);
    expect(kinds.slice(0, 4).sort()).toEqual(["collab-start", "kudos", "milestone", "session-start"]);
    expect(kinds[4]).toBe(kinds[0]);
  });

  it("is deterministic", () => {
    expect(demoEvent(sessions, 2)).toEqual(demoEvent(sessions, 2));
  });

  it("makes a milestone one row above the user's current row", () => {
    const one = [session("a", "ann", "alpha", 30e6)];
    const milestone = firstFour(one).find((e) => e?.kind === "milestone");
    expect(milestone).toEqual({ kind: "milestone", user: "ann", row: 3 });
  });

  it("caps the milestone row at the top of the ladder", () => {
    const top = [session("a", "ann", "alpha", 9e9)];
    const milestone = firstFour(top).find((e) => e?.kind === "milestone");
    expect(milestone).toEqual({ kind: "milestone", user: "ann", row: MILESTONES.length });
  });

  it("builds a collab-start with sorted users", () => {
    const collab = firstFour(sessions).find((e) => e?.kind === "collab-start");
    expect(collab).toEqual({ kind: "collab-start", project: "alpha", users: ["ann", "cy"] });
  });
});
