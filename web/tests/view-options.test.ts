import { describe, expect, it } from "vitest";
import { viewOptionsFrom } from "../view-options.ts";

describe("viewOptionsFrom", () => {
  it("keeps the normal one-time fit by default", () => {
    expect(viewOptionsFrom("")).toEqual({ autoFit: false, fitScale: 1 });
  });

  it("enables a persistent whole-city view", () => {
    expect(viewOptionsFrom("?view=all").autoFit).toBe(true);
    expect(viewOptionsFrom("?mode=showcase")).toEqual({ autoFit: true, fitScale: 1.35 });
  });

  it("accepts a bounded fit zoom multiplier", () => {
    expect(viewOptionsFrom("?zoom=1.2").fitScale).toBe(1.2);
    expect(viewOptionsFrom("?zoom=99").fitScale).toBe(1.35);
    expect(viewOptionsFrom("?zoom=nope").fitScale).toBe(1);
  });
});
