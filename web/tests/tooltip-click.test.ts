import { describe, expect, it } from "vitest";
import { isClick } from "../tooltip.ts";

const down = { x: 100, y: 100, t: 1_000 };

describe("isClick", () => {
  it("accepts a quick press that barely moved", () => {
    expect(isClick(down, { x: 102, y: 101, t: 1_200 })).toBe(true);
  });

  it("refuses a drag of 5 px or more, which is an orbit rotation", () => {
    expect(isClick(down, { x: 105, y: 100, t: 1_100 })).toBe(false);
    expect(isClick(down, { x: 103, y: 104, t: 1_100 })).toBe(false);
  });

  it("accepts just under 5 px", () => {
    expect(isClick(down, { x: 104, y: 100, t: 1_100 })).toBe(true);
  });

  it("refuses a press held for 500 ms or more", () => {
    expect(isClick(down, { x: 100, y: 100, t: 1_500 })).toBe(false);
    expect(isClick(down, { x: 100, y: 100, t: 1_499 })).toBe(true);
  });
});
