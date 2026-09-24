import { describe, expect, it } from "vitest";
import { landmarkLabelSpecs, labelOpacity, selectNonOverlappingLabels } from "../landmark-labels.ts";

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

  it("keeps the highest-priority label when overview pills overlap", () => {
    const visible = selectNonOverlappingLabels([
      { key: "park", x: 100, y: 100, width: 90, height: 24, priority: 20 },
      { key: "station", x: 120, y: 104, width: 100, height: 24, priority: 90 },
      { key: "bridge", x: 250, y: 100, width: 80, height: 24, priority: 50 },
    ]);

    expect([...visible]).toEqual(["station", "bridge"]);
  });

  it("uses a stable key order when overlapping labels have equal priority", () => {
    const visible = selectNonOverlappingLabels([
      { key: "z", x: 40, y: 40, width: 80, height: 20, priority: 10 },
      { key: "a", x: 40, y: 40, width: 80, height: 20, priority: 10 },
    ]);

    expect([...visible]).toEqual(["a"]);
  });
});
