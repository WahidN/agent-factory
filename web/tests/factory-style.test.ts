import { describe, expect, it } from "vitest";
import { FACTORY_STYLE_COUNT, factoryStyleFor, factoryStyleIndex, resolveRoofMasses } from "../factory-style.ts";

describe("factoryStyleFor", () => {
  it("is stable for a session id", () => {
    expect(factoryStyleFor("session-42")).toEqual(factoryStyleFor("session-42"));
  });

  it("always selects a known style", () => {
    for (const id of ["", "a", "dennis/project", "session-300"]) {
      expect(factoryStyleIndex(id)).toBeGreaterThanOrEqual(0);
      expect(factoryStyleIndex(id)).toBeLessThan(FACTORY_STYLE_COUNT);
    }
  });

  it("produces visible diversity across representative ids", () => {
    const variants = new Set(Array.from({ length: 80 }, (_, i) => factoryStyleIndex(`session-${i}`)));
    expect(variants.size).toBe(FACTORY_STYLE_COUNT);
  });

  it("resolves every mass inside small and large hall roofs", () => {
    const styles = new Map<number, ReturnType<typeof factoryStyleFor>>();
    for (let i = 0; i < 200; i++) styles.set(factoryStyleIndex(`factory-${i}`), factoryStyleFor(`factory-${i}`));

    for (const [hallWidth, hallDepth] of [
      [14, 8],
      [22, 14],
    ]) {
      for (const style of styles.values()) {
        for (const mass of resolveRoofMasses(style, hallWidth, hallDepth)) {
          expect(Math.abs(mass.x) + mass.width / 2).toBeLessThanOrEqual(hallWidth / 2);
          expect(Math.abs(mass.z) + mass.depth / 2).toBeLessThanOrEqual(hallDepth / 2);
          expect(mass.height).toBeGreaterThan(0);
          expect(mass.elevation).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
