import { describe, expect, it } from "vitest";
import { landmarkLabelSpecs, labelOpacity } from "../landmark-labels.ts";

describe("landmark labels", () => {
  it("reveals labels gradually after their zoom threshold", () => {
    expect(labelOpacity(0.4, 0.5)).toBe(0);
    expect(labelOpacity(0.61, 0.5)).toBeCloseTo(0.5);
    expect(labelOpacity(0.8, 0.5)).toBe(1);
  });

  it("adds named bridges only when the visible Waal reaches them", () => {
    const withoutRiver = landmarkLabelSpecs(60, null);
    expect(withoutRiver.some((label) => label.kind === "bridge")).toBe(false);

    const withRiver = landmarkLabelSpecs(60, { west: 0, east: 180, z: 90, width: 20 });
    expect(withRiver.filter((label) => label.kind === "bridge").map((label) => label.name)).toEqual([
      "De Oversteek",
      "Waalbrug",
      "Spoorbrug",
    ]);
  });

  it("keeps fixed Nijmegen places deterministic", () => {
    expect(landmarkLabelSpecs(60, null)).toEqual(landmarkLabelSpecs(60, null));
    expect(landmarkLabelSpecs(60, null).some((label) => label.name === "Stevenskerk")).toBe(true);
  });
});
