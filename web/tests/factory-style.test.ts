import { describe, expect, it } from "vitest";
import { FACTORY_STYLE_COUNT, factoryStyleFor, factoryStyleIndex } from "../factory-style.ts";

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
    const variants = new Set(Array.from({ length: 30 }, (_, i) => factoryStyleIndex(`session-${i}`)));
    expect(variants.size).toBe(FACTORY_STYLE_COUNT);
  });
});
