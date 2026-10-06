import type { SessionState } from "../server/types.ts";
import type { CityEvent } from "./city-feed.ts";
import { MILESTONES, milestoneIndex } from "./milestone-ladder.ts";

/**
 * A made-up event for the showcase: step 0, 1, 2, ... walks over the four
 * kinds and over the sessions, so the same input always gives the same show.
 * Null while there are no sessions to borrow names from.
 */
export function demoEvent(sessions: readonly SessionState[], step: number): CityEvent | null {
  if (sessions.length === 0) return null;
  const pick = sessions[step % sessions.length];
  switch (step % 4) {
    case 0: {
      const current = Math.max(
        0,
        ...sessions.filter((s) => s.user === pick.user).map((s) => milestoneIndex(s.machineTokens)),
      );
      return { kind: "milestone", user: pick.user, row: Math.min(MILESTONES.length, current + 1) };
    }
    case 1:
      return { kind: "session-start", user: pick.user, project: pick.project, model: pick.model };
    case 2: {
      const users = new Set(sessions.filter((s) => s.project === pick.project).map((s) => s.user));
      return { kind: "collab-start", project: pick.project, users: [...users].sort() };
    }
    default:
      return { kind: "kudos", user: pick.user };
  }
}
