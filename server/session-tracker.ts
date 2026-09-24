// Holds state per session and subagent. No file system access and no clock of
// its own: callers pass `now`, so timing rules can be tested with a fake clock.

import { baseName, type SessionFile, type TranscriptEvent } from "./claude-reader.ts";
import type { AgentStatus, PlainMessage, SessionState } from "./types.ts";

export const SUBAGENT_REMOVE_MS = 60_000;
// A session counts as busy if its transcript was written to this recently,
// even when the session file itself still says idle (it lags the transcript).
export const SESSION_BUSY_MS = 5_000;

// The wire format has no room for a tool name or target, so the tracker keeps
// only the ids of tool calls without a result yet: whether any tool is open is
// one of the signals that decides busy vs idle.
type Listener = (message: PlainMessage) => void;

type Subagent = {
  model: string;
  lastWriteAt: number;
  openTools: Set<string>;
};

type Session = {
  file: SessionFile;
  model: string;
  lastWriteAt: number;
  openTools: Set<string>;
  subagents: Map<string, Subagent>;
};

function applyEvent(target: { openTools: Set<string>; model: string }, event: TranscriptEvent) {
  if (event.kind === "model") target.model = event.model;
  else if (event.kind === "tool_start") target.openTools.add(event.id);
  else target.openTools.delete(event.id);
}

export class SessionTracker {
  private sessions = new Map<string, Session>();
  private lastSent = new Map<string, string>();

  // `user` is stamped on every state: who runs the session, read once from
  // this machine's environment.
  constructor(
    private listener: Listener,
    private user = "",
  ) {}

  upsertSession(file: SessionFile, now: number) {
    const existing = this.sessions.get(file.sessionId);
    if (existing) existing.file = file;
    else
      this.sessions.set(file.sessionId, {
        file,
        model: "",
        lastWriteAt: 0,
        openTools: new Set(),
        subagents: new Map(),
      });
    this.emit(file.sessionId, now);
  }

  removeSession(sessionId: string) {
    if (!this.sessions.delete(sessionId)) return;
    this.lastSent.delete(sessionId);
    this.listener({ type: "session-removed", id: sessionId });
  }

  sessionIds() {
    return [...this.sessions.keys()];
  }

  // Applies one read of the transcript and emits at most once, with the state
  // after the whole read. `writtenAt` is when the session transcript last
  // changed, used to derive busy.
  applySessionEvents(sessionId: string, events: TranscriptEvent[], writtenAt: number, now: number) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.lastWriteAt = Math.max(session.lastWriteAt, writtenAt);
    for (const event of events) applyEvent(session, event);
    this.emit(sessionId, now);
  }

  // `writtenAt` is when the subagent transcript last changed.
  applySubagentEvents(sessionId: string, agentId: string, events: TranscriptEvent[], writtenAt: number, now: number) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    let subagent = session.subagents.get(agentId);
    if (!subagent) {
      subagent = { model: "", lastWriteAt: writtenAt, openTools: new Set() };
      session.subagents.set(agentId, subagent);
    }
    subagent.lastWriteAt = Math.max(subagent.lastWriteAt, writtenAt);
    for (const event of events) applyEvent(subagent, event);
    this.emit(sessionId, now);
  }

  // Call regularly so subagents turn idle and get removed as time passes.
  tick(now: number) {
    for (const [sessionId, session] of this.sessions) {
      for (const [agentId, subagent] of session.subagents) {
        const quiet = now - subagent.lastWriteAt;
        if (subagent.openTools.size === 0 && quiet >= SUBAGENT_REMOVE_MS) session.subagents.delete(agentId);
      }
      this.emit(sessionId, now);
    }
  }

  snapshot(now: number): SessionState[] {
    return [...this.sessions.keys()].map((id) => this.stateOf(id, now)!);
  }

  private stateOf(sessionId: string, now: number): SessionState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const { file } = session;
    const recentWrite = now - session.lastWriteAt < SESSION_BUSY_MS;
    const status: AgentStatus = file.status === "busy" || session.openTools.size > 0 || recentWrite ? "busy" : "idle";
    return {
      id: file.sessionId,
      user: this.user,
      project: baseName(file.cwd),
      model: session.model,
      status,
      subagents: session.subagents.size,
      startedAt: file.startedAt,
    };
  }

  // Sends an update only when the session's visible state actually changed.
  private emit(sessionId: string, now: number) {
    const state = this.stateOf(sessionId, now);
    if (!state) return;
    const serialized = JSON.stringify(state);
    if (this.lastSent.get(sessionId) === serialized) return;
    this.lastSent.set(sessionId, serialized);
    this.listener({ type: "session-update", session: state });
  }
}
