// Pure text helpers for the yard sign. No DOM, no Three.js, so they are unit
// tested on their own. The sign itself (web/sign.ts) draws with these.

// Human readable model name from a model id. Family names are capitalized and
// the version becomes dotted: "claude-opus-5" -> "Opus 5",
// "claude-haiku-4-5-20251001" -> "Haiku 4.5", "claude-fable-5-1" -> "Fable 5.1".
// Short aliases from subagent meta files keep just the family: "opus" -> "Opus".
// Unknown ids are returned as-is; an empty id gives "".
// Known model families, same list as web/model-tier.ts (kept duplicated so
// this file has no import).
const FAMILIES = ["haiku", "sonnet", "opus", "fable", "mythos"];

export function modelLabel(model: string): string {
  if (model === "") return "";
  const id = model.toLowerCase();
  const family = FAMILIES.find((f) => id.includes(f));
  if (!family) return model;

  const label = family[0].toUpperCase() + family.slice(1);
  // Everything after the family name, minus a trailing 8-digit date suffix.
  let rest = id.slice(id.indexOf(family) + family.length);
  rest = rest.replace(/-\d{8}$/, "");
  const version = rest.replace(/^-/, "").replace(/-/g, ".");
  return version === "" ? label : `${label} ${version}`;
}

// File name part for a machine's avatar. Machine names arrive over the
// network from the hub, so only [a-z0-9-] survives: lowercased, every other
// run of characters becomes one "-", and leading/trailing "-" are trimmed.
// "MacBook-Pro-van-Wahid" -> "macbook-pro-van-wahid", "" -> "".
export function machineSlug(machine: string): string {
  return machine
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Up to two uppercase initials for the avatar fallback, one per word, words
// split on "-", "_", "." and spaces. "dennispassway-macbook" -> "DM",
// "wahid" -> "W", "" -> "?".
export function initialsFor(machine: string): string {
  const initials = machine
    .split(/[-_.\s]+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
  return initials === "" ? "?" : initials;
}

// Short token count for the tooltip: 950, 12k, 2.5M, 408M, 4.4B, 25B. One
// decimal below 10 of a unit, none above, and no trailing ".0". A value that
// rounds up to the next unit (999.95k) is shown in that unit (1M).
export function shortTokens(tokens: number): string {
  const units: [number, string][] = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ];
  for (const [size, suffix] of units) {
    if (tokens < size * 0.9995) continue;
    const value = tokens / size;
    const text = value < 9.95 ? value.toFixed(1).replace(/\.0$/, "") : Math.round(value).toString();
    return text + suffix;
  }
  return Math.round(tokens).toString();
}

// Shortens `text` with a trailing "…" until `measure(result) <= maxWidth`.
// `measure` is the caller's text width function (canvas measureText).
// Text that already fits is returned unchanged. Never returns just "…" for
// non-empty input: at least one character stays before the ellipsis.
export function truncate(text: string, maxWidth: number, measure: (text: string) => number): string {
  if (text === "" || measure(text) <= maxWidth) return text;

  // Shrink the kept prefix until it fits with the ellipsis, but never below
  // one character.
  let keep = Math.max(1, text.length - 1);
  while (keep > 1 && measure(text.slice(0, keep) + "…") > maxWidth) {
    keep--;
  }
  return text.slice(0, keep) + "…";
}
