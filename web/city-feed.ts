import type { SessionState } from "../server/types.ts";
import { milestoneIndex } from "./milestone-ladder.ts";

// Something that just happened in the city, as opposed to how things stand.
// The scene already draws state (milestones, HQ height); these are the
// moments in between that the ceremony, the ticker and the tour react to.
export type CityEvent =
  /** A user's season total reached a new row of the token ladder. `row` is the new milestoneIndex (1 = the first row). */
  | { kind: "milestone"; user: string; row: number }
  /** A session id the page had not seen before appeared. */
  | { kind: "session-start"; user: string; project: string; model: string }
  /** A project went from fewer than two distinct users to two or more. `users` is sorted. */
  | { kind: "collab-start"; project: string; users: string[] }
  /** Someone on the network sent this user kudos. Comes from the server, never from detection. */
  | { kind: "kudos"; user: string };

/** Anything the wiring hands events to. */
export interface CityEventSink {
  push(event: CityEvent): void;
}

/**
 * Turns successive session maps into CityEvents.
 *
 * Rules:
 * - The first observe() after construction or reset() is a baseline and returns [].
 *   The page reconnects every 2 s while the server is down; without this every HQ
 *   would celebrate on each reconnect.
 * - A milestone fires only when a user's row exceeds the highest row this page ever
 *   saw for that user (baseline included). A user who first appears after the
 *   baseline (say, their Mac just came online) takes their current row as that
 *   highest row without a milestone; their session-start still fires. The row is milestoneIndex of the highest
 *   machineTokens over that user's sessions, so two Macs under one name fire once,
 *   and a user who leaves and comes back does not fire again for the same row.
 * - session-start fires once per new session id after the baseline.
 * - collab-start fires when a project crosses from <2 to >=2 distinct users.
 */
export class CityFeed {
  private baselined = false;
  private readonly seenIds = new Set<string>();
  private readonly highestRow = new Map<string, number>();
  private collabProjects = new Set<string>();

  observe(sessions: ReadonlyMap<string, SessionState>): CityEvent[] {
    const events: CityEvent[] = [];
    const announce = this.baselined;
    const tokensByUser = new Map<string, number>();
    const usersByProject = new Map<string, Set<string>>();

    for (const session of sessions.values()) {
      if (!this.seenIds.has(session.id)) {
        this.seenIds.add(session.id);
        if (announce) {
          events.push({ kind: "session-start", user: session.user, project: session.project, model: session.model });
        }
      }
      tokensByUser.set(session.user, Math.max(tokensByUser.get(session.user) ?? 0, session.machineTokens ?? 0));
      const users = usersByProject.get(session.project) ?? new Set<string>();
      users.add(session.user);
      usersByProject.set(session.project, users);
    }

    for (const [user, tokens] of tokensByUser) {
      const row = milestoneIndex(tokens);
      const known = this.highestRow.get(user);
      if (known === undefined) {
        // First sight of this user: their current row is where they stand, not a feat.
        this.highestRow.set(user, row);
      } else if (row > known) {
        this.highestRow.set(user, row);
        if (announce) events.push({ kind: "milestone", user, row });
      }
    }

    const collabProjects = new Set<string>();
    for (const [project, users] of usersByProject) {
      if (users.size < 2) continue;
      collabProjects.add(project);
      if (announce && !this.collabProjects.has(project)) {
        events.push({ kind: "collab-start", project, users: [...users].sort() });
      }
    }
    this.collabProjects = collabProjects;

    this.baselined = true;
    return events;
  }

  /** Call on reconnect: the next observe() is a baseline again. Highest rows seen are kept. */
  reset(): void {
    this.baselined = false;
  }
}
