import { describe, expect, it } from "vitest";
import { CLAIMED, claimedUpTo, FILLER_CYCLE } from "../city-plan.ts";
import { tierFor } from "../model-tier.ts";
import { SHOWCASE_SESSION_COUNT, showcaseRequested, showcaseSessions } from "../showcase.ts";

describe("showcase mode", () => {
  it("is explicitly enabled through the URL", () => {
    expect(showcaseRequested("?mode=showcase")).toBe(true);
    expect(showcaseRequested("?view=all")).toBe(false);
  });

  it("builds a varied but deterministic synthetic population", () => {
    const sessions = showcaseSessions();
    expect(sessions).toHaveLength(SHOWCASE_SESSION_COUNT);
    expect(new Set(sessions.map(({ status }) => status))).toEqual(new Set(["busy", "idle"]));
    expect(new Set(sessions.map(({ model }) => tierFor(model)))).toEqual(new Set(["small", "medium", "large", "huge"]));
    expect(showcaseSessions()).toEqual(sessions);
  });

  it("grows far enough to reveal every landmark and filler family", () => {
    const amenities = claimedUpTo(SHOWCASE_SESSION_COUNT).map(({ amenity }) => amenity);
    for (const amenity of new Set(CLAIMED.values())) expect(amenities).toContain(amenity);
    for (const amenity of FILLER_CYCLE) expect(amenities).toContain(amenity);
  });
});
