import { describe, expect, it } from "vitest";
import { amenityAt } from "../city-plan.ts";
import { assignPlots, curveCell, PlotAllocator, plotCell } from "../plots.ts";

describe("PlotAllocator", () => {
  it("keeps a session's plot stable across repeat assigns", () => {
    const plots = new PlotAllocator();
    const first = plots.assign("a", "dennis");
    expect(plots.assign("a", "dennis")).toBe(first);
  });

  it("recomputes plots after a release, still packed with no gaps", () => {
    const plots = new PlotAllocator();
    for (const id of ["a", "b", "c", "d"]) plots.assign(id, "dennis");

    plots.release("b");

    const remaining = ["a", "c", "d"].map((id) => plots.indexOf(id));
    expect(new Set(remaining)).toEqual(new Set([0, 1, 2]));
  });
});

describe("assignPlots", () => {
  it("gives the same layout no matter what order the sessions arrive in", () => {
    const sessions = [
      { id: "s1", user: "dennis" },
      { id: "s2", user: "wahid" },
      { id: "s3", user: "dennis" },
      { id: "s4", user: "sara" },
      { id: "s5", user: "wahid" },
    ];
    const forward = assignPlots(sessions);
    const shuffled = assignPlots([...sessions].reverse());
    const alsoShuffled = assignPlots([sessions[2], sessions[0], sessions[4], sessions[3], sessions[1]]);

    for (const { id } of sessions) {
      expect(shuffled.get(id)).toBe(forward.get(id));
      expect(alsoShuffled.get(id)).toBe(forward.get(id));
    }
  });

  it("packs every session into 0..n-1 with no gaps, regardless of how many users share them", () => {
    // Compactness is the point: 150 sessions from one user, or 150 sessions
    // split over ten users, must take up exactly the same amount of room.
    const oneUser = Array.from({ length: 150 }, (_, i) => ({ id: `s${i}`, user: "dennis" }));
    const tenUsers = Array.from({ length: 150 }, (_, i) => ({ id: `s${i}`, user: `user${i % 10}` }));

    for (const sessions of [oneUser, tenUsers]) {
      const assignment = assignPlots(sessions);
      expect(new Set(assignment.values())).toEqual(new Set(Array.from({ length: 150 }, (_, i) => i)));
    }
  });

  it("keeps one user's sessions in a single contiguous run of plots", () => {
    const sessions = [
      { id: "d1", user: "dennis" },
      { id: "w1", user: "wahid" },
      { id: "d2", user: "dennis" },
      { id: "w2", user: "wahid" },
      { id: "d3", user: "dennis" },
    ];
    const assignment = assignPlots(sessions);
    const dennisIndexes = ["d1", "d2", "d3"].map((id) => assignment.get(id)!);
    const span = Math.max(...dennisIndexes) - Math.min(...dennisIndexes) + 1;
    expect(span).toBe(dennisIndexes.length); // no gap, and no other user's plot in between
  });

  it("removing a session is allowed to shift the plots that come after it", () => {
    // The park stays compact: a session that leaves does not keep its plot
    // empty forever. This is now explicitly allowed, unlike the earlier
    // district based layout.
    const sessions = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, user: "dennis" }));
    const before = assignPlots(sessions);
    const after = assignPlots(sessions.filter((s) => s.id !== "s0"));

    expect(new Set(after.values())).toEqual(new Set([0, 1, 2, 3]));
    // s0 sat at index 0, so everything after it is free to have moved down.
    expect(after.get("s1")).not.toBe(before.get("s1"));
  });

  it("still gives a valid, gap free assignment when hashes collide", () => {
    // "Aa" and "BB" hash to the same 32 bit value under the shift-and-add
    // hash used here, a classic collision pair for this style of hash.
    const sessions = [
      { id: "Aa", user: "dennis" },
      { id: "BB", user: "dennis" },
      { id: "other-user-Aa", user: "Aa" },
      { id: "other-user-BB", user: "BB" },
    ];
    const assignment = assignPlots(sessions);
    expect(new Set(assignment.values())).toEqual(new Set([0, 1, 2, 3]));
  });
});

describe("curveCell", () => {
  it("gives every index its own cell", () => {
    const cells = Array.from({ length: 500 }, (_, i) => curveCell(i));
    expect(new Set(cells.map((c) => `${c.col},${c.row}`)).size).toBe(500);
  });

  it("steps one cell at a time, so the curve never jumps", () => {
    for (let i = 1; i < 500; i++) {
      const a = curveCell(i - 1);
      const b = curveCell(i);
      expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row)).toBe(1);
    }
  });

  // This is the whole reason for the Hilbert curve. assignPlots gives each
  // user a contiguous run of indexes, so a run has to sit in a blob. On the
  // square-shell order this replaced, a run of five near index 140 stretched
  // thirteen cells wide, which is why one user's factories used to lie in a
  // diagonal streak across the park instead of next to each other.
  it("keeps a contiguous run of indexes in a compact blob, wherever it starts", () => {
    for (const start of [0, 7, 20, 40, 97, 140, 260]) {
      const cells = Array.from({ length: 5 }, (_, i) => curveCell(start + i));
      const cols = cells.map((c) => c.col);
      const rows = cells.map((c) => c.row);
      const widest = Math.max(Math.max(...cols) - Math.min(...cols), Math.max(...rows) - Math.min(...rows)) + 1;
      expect(widest).toBeLessThanOrEqual(4);
    }
  });
});

describe("plotCell", () => {
  it("gives every rank its own cell", () => {
    const cells = Array.from({ length: 500 }, (_, rank) => plotCell(rank));
    expect(new Set(cells.map((c) => `${c.col},${c.row}`)).size).toBe(500);
  });

  it("never hands a session a cell the city plan claimed", () => {
    for (let rank = 0; rank < 400; rank++) expect(amenityAt(plotCell(rank))).toBeNull();
  });

  // Sessions now step over the claimed cells, so a run of five is no longer
  // guaranteed to be four cells wide; it still has to stay a blob rather than
  // a streak across the park.
  it("keeps a contiguous run of ranks in a compact blob, wherever it starts", () => {
    for (const start of [0, 7, 20, 40, 97, 140, 260]) {
      const cells = Array.from({ length: 5 }, (_, i) => plotCell(start + i));
      const cols = cells.map((c) => c.col);
      const rows = cells.map((c) => c.row);
      const widest = Math.max(Math.max(...cols) - Math.min(...cols), Math.max(...rows) - Math.min(...rows)) + 1;
      expect(widest).toBeLessThanOrEqual(5);
    }
  });

  // The whole point of the city plan: the same set of sessions gives the same
  // city twice over, whatever order the sessions came in.
  it("maps the same set of sessions onto the same cells twice over", () => {
    const sessions = [
      { id: "s1", user: "dennis" },
      { id: "s2", user: "wahid" },
      { id: "s3", user: "dennis" },
      { id: "s4", user: "sara" },
    ];
    const cellsFor = (list: typeof sessions) => {
      const assignment = assignPlots(list);
      return sessions.map(({ id }) => plotCell(assignment.get(id)!));
    };
    expect(cellsFor([...sessions].reverse())).toEqual(cellsFor(sessions));
  });
});
