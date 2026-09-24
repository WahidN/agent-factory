import { describe, expect, it } from "vitest";
import { health } from "../health.ts";

describe("health", () => {
  it("reports a central with zero reporters instead of failing it", () => {
    expect(health({ mode: "central", reporters: 0, lastUpdateAt: 0, now: 1_000 })).toEqual({
      mode: "central",
      reporters: 0,
      lastUpdateAgeMs: null,
    });
  });

  it("reports how long ago the last update was, however long", () => {
    const now = 10_000_000;
    expect(health({ mode: "central", reporters: 1, lastUpdateAt: now - 3_600_000, now })).toEqual({
      mode: "central",
      reporters: 1,
      lastUpdateAgeMs: 3_600_000,
    });
  });

  it("gives null for the age when nothing was ever seen", () => {
    expect(health({ mode: "local", reporters: 0, lastUpdateAt: 0, now: 1_000 }).lastUpdateAgeMs).toBeNull();
  });

  it("includes the mode", () => {
    expect(health({ mode: "reporter", reporters: 0, lastUpdateAt: 500, now: 1_000 })).toEqual({
      mode: "reporter",
      reporters: 0,
      lastUpdateAgeMs: 500,
    });
  });
});
