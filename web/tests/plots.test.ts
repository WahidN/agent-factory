import { describe, expect, it } from "vitest";
import { PlotAllocator, plotCell } from "../plots.ts";

describe("PlotAllocator", () => {
  it("assigns plots in order and keeps them stable", () => {
    const plots = new PlotAllocator();
    expect(["a", "b", "c"].map((id) => plots.assign(id))).toEqual([0, 1, 2]);
    expect(plots.assign("b")).toBe(1);
  });

  it("adding and removing sessions never moves other plots", () => {
    const plots = new PlotAllocator();
    ["a", "b", "c", "d"].forEach((id) => plots.assign(id));

    plots.release("b");
    expect(plots.indexOf("a")).toBe(0);
    expect(plots.indexOf("c")).toBe(2);
    expect(plots.indexOf("d")).toBe(3);

    expect(plots.assign("e")).toBe(1); // reuses the freed plot
    expect(plots.assign("f")).toBe(4);
    expect([plots.indexOf("a"), plots.indexOf("c"), plots.indexOf("d")]).toEqual([0, 2, 3]);
  });
});

describe("plotCell", () => {
  it("gives every index a unique cell, growing outward in square shells", () => {
    const cells = Array.from({ length: 25 }, (_, i) => plotCell(i));
    expect(new Set(cells.map((c) => `${c.col},${c.row}`)).size).toBe(25);
    for (let i = 0; i < 25; i++) {
      const shell = Math.floor(Math.sqrt(i));
      expect(Math.max(cells[i].col, cells[i].row)).toBe(shell);
    }
    expect(cells.slice(0, 4)).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 0, row: 1 },
    ]);
  });
});
