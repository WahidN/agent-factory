import { describe, expect, it, vi } from "vitest";
import type { SessionState } from "../../server/types.ts";
import { Scoreboard, scoreLines, scoreRecords } from "../scoreboard.ts";

const setLines = vi.fn();
vi.mock("../text-board.ts", async () => {
  const THREE = await import("three");
  const actual = await vi.importActual<typeof import("../text-board.ts")>("../text-board.ts");
  return {
    wrapLines: actual.wrapLines,
    TextBoard: class {
      group = new THREE.Group();
      maxChars = 16;
      setLines = setLines;
      tick = vi.fn();
      dispose = vi.fn();
    },
  };
});

const NOW = 1_000_000_000_000;
const MIN = 60_000;

function session(over: Partial<SessionState>): SessionState {
  return {
    id: "s",
    user: "anna",
    project: "web",
    model: "",
    status: "idle",
    subagents: 0,
    startedAt: NOW,
    ...over,
  } as SessionState;
}

describe("scoreRecords", () => {
  it("names the oldest session as longest, in hours and minutes", () => {
    const records = scoreRecords(
      [
        session({ id: "a", user: "anna", startedAt: NOW - 65 * MIN }),
        session({ id: "b", user: "bram", startedAt: NOW - 45 * MIN }),
      ],
      NOW,
    );
    expect(records[0]).toEqual({ title: "Langste sessie", holder: "anna", value: "1u 05m" });
  });

  it("shows minutes only under an hour", () => {
    const records = scoreRecords([session({ startedAt: NOW - 45 * MIN })], NOW);
    expect(records[0].value).toBe("45m");
  });

  it("skips most subagents when nobody has any", () => {
    const records = scoreRecords([session({ subagents: 0 })], NOW);
    expect(records.map((r) => r.title)).not.toContain("Meeste subagents");
  });

  it("names the user with the most subagents", () => {
    const records = scoreRecords(
      [session({ id: "a", user: "anna", subagents: 1 }), session({ id: "b", user: "bram", subagents: 3 })],
      NOW,
    );
    expect(records.find((r) => r.title === "Meeste subagents")).toEqual({
      title: "Meeste subagents",
      holder: "bram",
      value: "3",
    });
  });

  it("counts sessions per project for busiest project", () => {
    const records = scoreRecords(
      [
        session({ id: "a", project: "web" }),
        session({ id: "b", project: "api" }),
        session({ id: "c", project: "api" }),
      ],
      NOW,
    );
    expect(records.find((r) => r.title === "Drukste project")).toEqual({
      title: "Drukste project",
      holder: "api",
      value: "2 sessies",
    });
  });

  it("breaks ties on name", () => {
    const records = scoreRecords(
      [
        session({ id: "a", user: "bram", project: "zeta", subagents: 2, startedAt: NOW - MIN }),
        session({ id: "b", user: "anna", project: "alfa", subagents: 2, startedAt: NOW - MIN }),
      ],
      NOW,
    );
    expect(records.map((r) => r.holder)).toEqual(["anna", "anna", "alfa"]);
  });

  it("says no match yet for an empty list", () => {
    expect(scoreLines(scoreRecords([], NOW), 20)).toEqual(["Nog geen wedstrijd"]);
  });
});

describe("scoreLines", () => {
  it("puts the title and the holder with value on two rows", () => {
    expect(scoreLines([{ title: "Langste sessie", holder: "anna", value: "1u 05m" }], 20)).toEqual([
      "Langste sessie",
      "anna, 1u 05m",
    ]);
  });

  it("cuts a row that is too long instead of running off the board", () => {
    const lines = scoreLines([{ title: "Meeste subagents", holder: "een-heel-lange-naam", value: "12" }], 10);
    expect(lines.every((l) => l.length <= 10)).toBe(true);
    expect(lines[0].endsWith("…")).toBe(true);
  });
});

describe("Scoreboard", () => {
  it("hands the board only rows that fit its width", () => {
    setLines.mockClear();
    const board = new Scoreboard();
    board.update(
      [session({ user: "een-heel-lange-gebruikersnaam", project: "een-heel-lang-projectnaam", subagents: 2 })],
      NOW,
    );
    const lines = (setLines.mock.lastCall as [string[]])[0];
    expect(lines[0]).toBe("GOFFERT");
    expect(lines.length).toBe(7);
    expect(lines.every((l) => l.length <= 16)).toBe(true);
    board.dispose();
  });
});
