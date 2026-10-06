import { beforeEach, describe, expect, it, vi } from "vitest";
import { TextBoard, landmarkPosition, wrapLines } from "../text-board.ts";

let paints = 0;

beforeEach(() => {
  paints = 0;
  const context = {
    fillStyle: "",
    font: "",
    textBaseline: "",
    fillRect: () => {
      paints++;
    },
    fillText: () => {},
  };
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
});

const options = { width: 10, height: 4, rows: 4, background: "#000", foreground: "#fff" };

describe("landmarkPosition", () => {
  it("finds the Goffert once the city is big enough", () => {
    const place = landmarkPosition("goffert", 1);
    expect(place).not.toBeNull();
    expect(place?.x).toBeCloseTo(0);
    expect(place?.z).toBeCloseTo(0);
  });

  it("returns null for an amenity that is not built yet", () => {
    expect(landmarkPosition("goffert", 0)).toBeNull();
    expect(landmarkPosition("no-such-amenity", 1)).toBeNull();
  });
});

describe("TextBoard", () => {
  it("does not repaint when nothing changed", () => {
    const board = new TextBoard(options);
    board.tick(1000);
    const after = paints;
    board.tick(2000);
    expect(paints).toBe(after);
  });

  it("repaints at most 10 times a second", () => {
    const board = new TextBoard(options);
    board.tick(1000);
    const base = paints;
    board.setLines(["a"]);
    board.tick(1010);
    expect(paints).toBe(base);
    board.tick(1100);
    expect(paints).toBe(base + 1);
  });

  it("collapses a burst of setLines into one repaint", () => {
    const board = new TextBoard(options);
    board.tick(1000);
    const base = paints;
    board.setLines(["a"]);
    board.setLines(["b"]);
    board.tick(1200);
    expect(paints).toBe(base + 1);
  });
});

describe("TextBoard.maxChars", () => {
  it("grows with the board width and shrinks with taller rows", () => {
    const wide = new TextBoard({ ...options, width: 20 });
    const narrow = new TextBoard({ ...options, width: 10 });
    const tall = new TextBoard({ ...options, width: 10, height: 8 });
    expect(wide.maxChars).toBeGreaterThan(narrow.maxChars);
    expect(tall.maxChars).toBeLessThan(narrow.maxChars);
  });

  it("matches the row geometry: 10 x 4 with 4 rows is 100 px rows, 70 px glyph height", () => {
    // (1000 - 2 * 30) / (0.6 * 70) = 22.38
    expect(new TextBoard(options).maxChars).toBe(22);
  });
});

describe("wrapLines", () => {
  it("breaks on a word boundary", () => {
    expect(wrapLines("aaa bbb ccc", 7, 2)).toEqual(["aaa bbb", "ccc"]);
  });

  it("ends in an ellipsis when the text does not fit", () => {
    expect(wrapLines("aaa bbb ccc ddd eee", 7, 2)).toEqual(["aaa bbb", "ccc…"]);
  });
});
