// Maps a model id to a lot size. Matches on family names, so dated ids like
// "claude-haiku-4-5-20251001" and short aliases like "opus" both work.

export type ModelTier = "small" | "medium" | "large" | "huge";

const FAMILIES: [string, ModelTier][] = [
  ["haiku", "small"],
  ["sonnet", "medium"],
  ["opus", "large"],
  ["fable", "huge"],
  ["mythos", "huge"],
];

// Unknown models, and no model yet, get the medium lot.
export function tierFor(model: string): ModelTier {
  const id = model.toLowerCase();
  return FAMILIES.find(([family]) => id.includes(family))?.[1] ?? "medium";
}
