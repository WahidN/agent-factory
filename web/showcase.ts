import type { SessionState } from "../server/types.ts";

// Thirteen is the first rank count that has walked past every fixed landmark
// and every filler family. Keeping it exact avoids the next Hilbert expansion,
// so the assets remain large enough to inspect in a single overview.
export const SHOWCASE_SESSION_COUNT = 13;

const USERS = ["dennis", "wahid", "sara", "noor"];
const PROJECTS = ["agent-factory", "webshop", "api", "mobility", "culture", "waal", "station", "waalsprong"];
const MODELS = ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5", "claude-fable-5-1"];
// One token total per user, spread over the ladder so a single overview shows
// an empty yard next to a fully earned one.
const TOKENS = [0, 40e6, 600e6, 5e9];

export function showcaseRequested(search: string): boolean {
  return new URLSearchParams(search).get("mode") === "showcase";
}

/** A stable, varied city for visually checking every asset family at once. */
export function showcaseSessions(count = SHOWCASE_SESSION_COUNT): SessionState[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `showcase-${String(index + 1).padStart(2, "0")}`,
    user: USERS[index % USERS.length],
    project: PROJECTS[index % PROJECTS.length],
    model: MODELS[index % MODELS.length],
    status: index % 3 === 0 ? "idle" : "busy",
    subagents: index % 4,
    startedAt: index * 60_000,
    machineTokens: TOKENS[index % USERS.length],
  }));
}
