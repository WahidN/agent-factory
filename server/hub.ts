// Merges the sessions other machines relay into one list next to our own.
// Pure: no sockets and no clock. index.ts feeds it one machine's messages and
// broadcasts whatever comes back.

import type { ServerMessage, SessionState } from "./types.ts";

// Bump when ServerMessage or AgentState change shape in a way an older hub cannot show.
export const PROTOCOL = 2;

// `machine` stays in the hello even though it left the session state: the
// hello is one message per connection, not per session, so it costs nothing
// on the wire per session. The hub uses it to prefix session ids and to let a
// reconnecting machine take over its own sessions. `user` rides along on
// every session instead.
export type Hello = { type: "hello"; protocol: number; user: string; machine: string; token?: string };
export type RelayMessage = Hello | ServerMessage;

const RELAY_TYPES = new Set(["hello", "snapshot", "session-update", "session-removed"]);

// Loose shape check only. The hub trusts machines on its own network.
export function parseRelayMessage(text: string): RelayMessage | null {
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" && RELAY_TYPES.has(data.type) ? (data as RelayMessage) : null;
  } catch {
    return null;
  }
}

export class Hub {
  private owned = new Map<string, Set<string>>(); // machine -> prefixed ids it sent
  private sessions = new Map<string, SessionState>(); // prefixed id -> latest state

  join(machine: string) {
    if (!this.owned.has(machine)) this.owned.set(machine, new Set());
  }

  // Turns one relayed message into the messages to broadcast. A snapshot also
  // removes whatever this machine sent before that is no longer in the list.
  apply(machine: string, message: ServerMessage): ServerMessage[] {
    const ids = this.owned.get(machine);
    if (!ids) return [];
    switch (message.type) {
      case "snapshot": {
        const keep = new Set(message.sessions.map((s) => prefixed(machine, s.id)));
        const out: ServerMessage[] = [];
        for (const id of [...ids]) if (!keep.has(id)) out.push(this.drop(ids, id));
        for (const session of message.sessions) out.push(this.put(ids, machine, session));
        return out;
      }
      case "session-update":
        return [this.put(ids, machine, message.session)];
      case "session-removed": {
        const id = prefixed(machine, message.id);
        return ids.has(id) ? [this.drop(ids, id)] : [];
      }
    }
  }

  // The machine's connection closed: everything it sent goes away.
  leave(machine: string): ServerMessage[] {
    const ids = this.owned.get(machine);
    if (!ids) return [];
    this.owned.delete(machine);
    return [...ids].map((id) => this.drop(ids, id));
  }

  remote(): SessionState[] {
    return [...this.sessions.values()];
  }

  private put(ids: Set<string>, machine: string, session: SessionState): ServerMessage {
    const stamped: SessionState = { ...session, id: prefixed(machine, session.id) };
    ids.add(stamped.id);
    this.sessions.set(stamped.id, stamped);
    return { type: "session-update", session: stamped };
  }

  private drop(ids: Set<string>, id: string): ServerMessage {
    ids.delete(id);
    this.sessions.delete(id);
    return { type: "session-removed", id };
  }
}

function prefixed(machine: string, id: string) {
  return `${machine}/${id}`;
}
