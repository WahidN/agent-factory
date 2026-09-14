import { describe, expect, it } from "vitest";
import { tierFor } from "../model-tier.ts";

describe("tierFor", () => {
  it("sizes by model family", () => {
    expect(tierFor("claude-haiku-4-5-20251001")).toBe("small");
    expect(tierFor("claude-sonnet-5")).toBe("medium");
    expect(tierFor("claude-opus-5")).toBe("large");
    expect(tierFor("claude-fable-5-1")).toBe("huge");
    expect(tierFor("claude-mythos-5-1")).toBe("huge");
  });

  it("understands the short aliases from subagent meta files", () => {
    expect(tierFor("haiku")).toBe("small");
    expect(tierFor("sonnet")).toBe("medium");
    expect(tierFor("opus")).toBe("large");
    expect(tierFor("Opus")).toBe("large");
  });

  it("falls back to medium for no model or an unknown one", () => {
    expect(tierFor("")).toBe("medium");
    expect(tierFor("<synthetic>")).toBe("medium");
    expect(tierFor("gpt-9")).toBe("medium");
  });
});
