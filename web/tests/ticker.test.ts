import { describe, expect, it, vi } from "vitest";

// TextBoard needs a canvas; the lines the ticker hands it are all we check.
const setLines = vi.fn();
vi.mock("../text-board.ts", async () => {
  const THREE = await import("three");
  const { wrapLines } = await vi.importActual<typeof import("../text-board.ts")>("../text-board.ts");
  return {
    wrapLines,
    TextBoard: class {
      group = new THREE.Group();
      texture = { offset: { x: 0 }, wrapS: 0 };
      maxChars = 24;
      setLines = setLines;
      tick = vi.fn();
      dispose = vi.fn();
    },
  };
});

import { formatEvent, Ticker } from "../ticker.ts";

describe("formatEvent", () => {
  it("formats a milestone with the threshold of that row", () => {
    expect(formatEvent({ kind: "milestone", user: "wahid", row: 9 })).toBe("wahid haalt 2.5B tokens");
    expect(formatEvent({ kind: "milestone", user: "wahid", row: 1 })).toBe("wahid haalt 10M tokens");
  });

  it("formats a session start with the model label", () => {
    expect(
      formatEvent({ kind: "session-start", user: "dennis", project: "agent-factory", model: "claude-opus-5" }),
    ).toBe("dennis start een Opus 5-sessie in agent-factory");
  });

  it("formats a collab of three users", () => {
    expect(formatEvent({ kind: "collab-start", project: "agent-factory", users: ["anna", "bas", "cor"] })).toBe(
      "anna, bas en cor werken samen aan agent-factory",
    );
    expect(formatEvent({ kind: "collab-start", project: "x", users: ["anna", "bas"] })).toBe(
      "anna en bas werken samen aan x",
    );
  });

  it("formats kudos", () => {
    expect(formatEvent({ kind: "kudos", user: "bas" })).toBe("Kudos voor bas!");
  });
});

describe("Ticker", () => {
  const lastShown = () => (setLines.mock.lastCall as [string[]])[0].join(" ");
  const kudos = (user: string) => ({ kind: "kudos", user }) as const;

  it("shows the idle text without events", () => {
    setLines.mockClear();
    const ticker = new Ticker();
    expect(lastShown()).toBe("Nijmegen aan het werk");
    ticker.dispose();
  });

  it("wraps long lines with the board's own character budget", () => {
    setLines.mockClear();
    const ticker = new Ticker();
    ticker.push({ kind: "session-start", user: "dennis", project: "agent-factory", model: "claude-opus-5" });
    const lines = (setLines.mock.lastCall as [string[]])[0];
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.every((l) => l.length <= 24)).toBe(true);
    ticker.dispose();
  });

  it("keeps the latest 5 events and rotates through them every 4 seconds, newest first", () => {
    const ticker = new Ticker();
    for (let i = 1; i <= 7; i++) ticker.push(kudos(`u${i}`));
    expect(lastShown()).toBe("Kudos voor u7!");
    ticker.tick(3.9, 0);
    expect(lastShown()).toBe("Kudos voor u7!");
    ticker.tick(0.2, 0);
    expect(lastShown()).toBe("Kudos voor u6!");
    for (let i = 0; i < 4; i++) ticker.tick(4, 0);
    expect(lastShown()).toBe("Kudos voor u7!");
    ticker.dispose();
  });

  it("jumps to the new event and restarts the timer on push", () => {
    const ticker = new Ticker();
    ticker.push(kudos("a"));
    ticker.push(kudos("b"));
    ticker.tick(4, 0);
    expect(lastShown()).toBe("Kudos voor a!");
    ticker.tick(3, 0);
    ticker.push(kudos("c"));
    expect(lastShown()).toBe("Kudos voor c!");
    ticker.tick(3, 0);
    expect(lastShown()).toBe("Kudos voor c!");
    ticker.dispose();
  });
});
