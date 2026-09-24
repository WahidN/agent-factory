import { describe, expect, it } from "vitest";
import { avatarSlug, initialsFor, modelLabel, shortTokens, truncate } from "../sign-text.ts";

describe("modelLabel", () => {
  it("labels dated ids by dropping the date suffix", () => {
    expect(modelLabel("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
  });

  it("labels plain versioned ids", () => {
    expect(modelLabel("claude-opus-5")).toBe("Opus 5");
    expect(modelLabel("claude-sonnet-5")).toBe("Sonnet 5");
    expect(modelLabel("claude-fable-5-1")).toBe("Fable 5.1");
  });

  it("keeps short aliases as just the family name", () => {
    expect(modelLabel("opus")).toBe("Opus");
    expect(modelLabel("haiku")).toBe("Haiku");
  });

  it("returns an empty id unchanged", () => {
    expect(modelLabel("")).toBe("");
  });

  it("returns an unknown id unchanged", () => {
    expect(modelLabel("gpt-5")).toBe("gpt-5");
  });
});

describe("avatarSlug", () => {
  it("lowercases and collapses non alphanumeric runs to one dash", () => {
    expect(avatarSlug("MacBook-Pro-van-Wahid")).toBe("macbook-pro-van-wahid");
    expect(avatarSlug("dennis passway.local")).toBe("dennis-passway-local");
  });

  it("trims leading and trailing dashes", () => {
    expect(avatarSlug("--Wahid--")).toBe("wahid");
  });

  it("returns an empty user name unchanged", () => {
    expect(avatarSlug("")).toBe("");
  });
});

describe("initialsFor", () => {
  it("takes one initial per word up to two", () => {
    expect(initialsFor("dennispassway-macbook")).toBe("DM");
    expect(initialsFor("macbook-pro-van-wahid")).toBe("MP");
  });

  it("handles a single word", () => {
    expect(initialsFor("wahid")).toBe("W");
  });

  it("splits on dash, underscore, dot and spaces", () => {
    expect(initialsFor("dennis_passway.macbook van wahid")).toBe("DP");
  });

  it("skips empty words from repeated separators", () => {
    expect(initialsFor("--wahid--macbook")).toBe("WM");
  });

  it("returns a placeholder for an empty machine name", () => {
    expect(initialsFor("")).toBe("?");
  });
});

describe("truncate", () => {
  const measure = (s: string) => s.length;

  it("returns text unchanged when it already fits", () => {
    expect(truncate("hello", 10, measure)).toBe("hello");
  });

  it("shortens with a trailing ellipsis until it fits", () => {
    expect(truncate("hello world", 6, measure)).toBe("hello…");
  });

  it("keeps at least one character before the ellipsis", () => {
    expect(truncate("hello", 1, measure)).toBe("h…");
  });

  it("keeps one character even for single-character input that does not fit", () => {
    expect(truncate("h", 0.5, measure)).toBe("h…");
  });

  it("returns empty input unchanged", () => {
    expect(truncate("", 5, measure)).toBe("");
  });
});

describe("shortTokens", () => {
  it("keeps small counts as plain digits", () => {
    expect(shortTokens(0)).toBe("0");
    expect(shortTokens(950)).toBe("950");
  });

  it("uses k, M and B with one decimal below 10 of a unit", () => {
    expect(shortTokens(12_345)).toBe("12k");
    expect(shortTokens(2_500_000)).toBe("2.5M");
    expect(shortTokens(408_400_000)).toBe("408M");
    expect(shortTokens(4_430_000_000)).toBe("4.4B");
    expect(shortTokens(25e9)).toBe("25B");
  });

  it("drops a trailing .0 and rounds up into the next unit", () => {
    expect(shortTokens(5e9)).toBe("5B");
    expect(shortTokens(999_950)).toBe("1M");
  });
});
