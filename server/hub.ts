// Merges the sessions other machines relay into one list next to our own.
// Pure: no sockets and no clock. index.ts feeds it one machine's messages and
// broadcasts whatever comes back.

import type { PlainMessage, SessionState } from "./types.ts";

// Bump when ServerMessage or AgentState change shape in a way an older hub cannot show.
// 3: SessionState carries machineTokens.
export const PROTOCOL = 3;
// The oldest protocol a hub still accepts. Thirty Macs cannot update in
// lockstep, so a hub takes a range [MIN_PROTOCOL, PROTOCOL] instead of one
// exact number. Raise this only once every reporter in the fleet has moved
// past it. A reporter on 2 sends no machineTokens, so its lots show no total.
export const MIN_PROTOCOL = 2;

// Whether a hub speaking PROTOCOL still understands a reporter on `protocol`.
export function protocolSupported(protocol: number): boolean {
  return protocol >= MIN_PROTOCOL && protocol <= PROTOCOL;
}

// `machine` lives in the hello and not in the session state: the hello is one
// message per connection, so it costs nothing on the wire per session. The hub
// uses it to prefix session ids and to let a reconnecting machine take over
// its own sessions. `user` rides along on every session instead.
export type Hello = { type: "hello"; protocol: number; user: string; machine: string; token?: string };
// A reporter never batches: batching only happens between the hub and the
// browsers it feeds, one tick at a time.
export type RelayMessage = Hello | PlainMessage;

// Checks every field the hub reads or forwards, so one reporter with a bug
// cannot crash the central or push a broken session to every browser. Extra
// fields are dropped later, in `put`.
export function parseRelayMessage(text: string): RelayMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  switch (data.type) {
    case "hello":
      return typeof data.protocol === "number" &&
        typeof data.machine === "string" &&
        data.machine !== "" &&
        typeof data.user === "string" &&
        (data.token === undefined || typeof data.token === "string")
        ? (data as Hello)
        : null;
    case "snapshot":
      return Array.isArray(data.sessions) && data.sessions.every(isSession) ? (data as RelayMessage) : null;
    case "session-update":
      return isSession(data.session) ? (data as RelayMessage) : null;
    case "session-removed":
      return typeof data.id === "string" ? (data as RelayMessage) : null;
    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSession(value: unknown): value is SessionState {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.user === "string" &&
    typeof value.project === "string" &&
    typeof value.model === "string" &&
    (value.status === "busy" || value.status === "idle") &&
    Number.isFinite(value.subagents) &&
    Number.isFinite(value.startedAt) &&
    (value.machineTokens === undefined || Number.isFinite(value.machineTokens))
  );
}

export class Hub {
  private owned = new Map<string, Set<string>>(); // machine -> prefixed ids it sent
  private sessions = new Map<string, SessionState>(); // prefixed id -> latest state

  join(machine: string) {
    if (!this.owned.has(machine)) this.owned.set(machine, new Set());
  }

  // Turns one relayed message into the messages to broadcast. A snapshot also
  // removes whatever this machine sent before that is no longer in the list.
  apply(machine: string, message: PlainMessage): PlainMessage[] {
    const ids = this.owned.get(machine);
    if (!ids) return [];
    switch (message.type) {
      case "snapshot": {
        const keep = new Set(message.sessions.map((s) => prefixed(machine, s.id)));
        const out: PlainMessage[] = [];
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
  leave(machine: string): PlainMessage[] {
    const ids = this.owned.get(machine);
    if (!ids) return [];
    this.owned.delete(machine);
    return [...ids].map((id) => this.drop(ids, id));
  }

  remote(): SessionState[] {
    return [...this.sessions.values()];
  }

  private put(ids: Set<string>, machine: string, session: SessionState): PlainMessage {
    // Copies the wire fields by name, so an extra field a reporter sends never
    // reaches a browser. A reporter on protocol 2 sends no machineTokens; the
    // field then stays off the state instead of going out as 0.
    const { user, project, model, status, subagents, startedAt, machineTokens } = session;
    const stamped: SessionState = {
      id: prefixed(machine, session.id),
      user,
      project,
      model,
      status,
      subagents,
      startedAt,
      ...(machineTokens === undefined ? {} : { machineTokens }),
    };
    ids.add(stamped.id);
    this.sessions.set(stamped.id, stamped);
    return { type: "session-update", session: stamped };
  }

  private drop(ids: Set<string>, id: string): PlainMessage {
    ids.delete(id);
    this.sessions.delete(id);
    return { type: "session-removed", id };
  }
}

function prefixed(machine: string, id: string) {
  return `${machine}/${id}`;
}
