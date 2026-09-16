// Holds state per session and subagent. No file system access and no clock of
// its own: callers pass `now`, so timing rules can be tested with a fake clock.

import { baseName, type SessionFile, type TranscriptEvent } from "./claude-reader.ts";
import type { AgentStatus, PlainMessage, SessionState } from "./types.ts";

export const SUBAGENT_BUSY_MS = 5_000;
export const SUBAGENT_REMOVE_MS = 60_000;
// A session counts as busy if its transcript was written to this recently,
// even when the session file itself still says idle (it lags the transcript).
export const SESSION_BUSY_MS = 5_000;

// Tool events no longer leave the machine: the wire format has no room for a
// tool name or target. The tracker still reads them, because whether a tool
// is open is one of the signals that decides busy vs idle.
type CurrentTool = { name: string; target: string };

type Listener = (message: PlainMessage) => void;

// Tool calls without a result yet, in the order they started.
class PendingTools {
  private pending = new Map<string, CurrentTool>();

  apply(event: TranscriptEvent) {
    if (event.kind === "tool_start") this.pending.set(event.id, { name: event.name, target: event.target });
    else if (event.kind === "tool_end") this.pending.delete(event.id);
  }

  current(): CurrentTool | null {
    let last: CurrentTool | null = null;
    for (const tool of this.pending.values()) last = tool;
    return last;
  }
}

// `model` is what the transcript names; `alias` is the short name from the
// meta file, shown until the transcript names a model.
type Subagent = {
  id: string;
  name: string;
  alias: string;
  model: string;
  startedAt: number;
  lastWriteAt: number;
  tools: PendingTools;
};

type Session = {
  file: SessionFile;
  model: string;
  lastWriteAt: number;
  tools: PendingTools;
  subagents: Map<string, Subagent>;
};

export type SubagentInfo = { name: string; model: string };

function applyEvent(target: { tools: PendingTools; model: string }, event: TranscriptEvent) {
  if (event.kind === "model") target.model = event.model;
  else target.tools.apply(event);
}

export class SessionTracker {
  private sessions = new Map<string, Session>();
  private lastSent = new Map<string, string>();

  // `user` is stamped on every state: who runs the session, from this
  // machine's env, same idea as `machine` used to be before it left the wire.
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
        tools: new PendingTools(),
        subagents: new Map(),
      });
    this.emit(file.sessionId, now);
  }

  removeSession(sessionId: string) {
    if (!this.sessions.delete(sessionId)) return;
    this.lastSent.delete(sessionId);
    this.listener({ type: "session-removed", id: sessionId });
  }

  hasSession(sessionId: string) {
    return this.sessions.has(sessionId);
  }

  sessionIds() {
    return [...this.sessions.keys()];
  }

  // Emits after every event, so a tool that starts and ends in the same read
  // still reaches clients as two updates instead of vanishing. `writtenAt` is
  // when the session transcript last changed, used to derive busy.
  applySessionEvents(sessionId: string, events: TranscriptEvent[], writtenAt: number, now: number) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.lastWriteAt = Math.max(session.lastWriteAt, writtenAt);
    this.emit(sessionId, now);
    for (const event of events) {
      applyEvent(session, event);
      this.emit(sessionId, now);
    }
  }

  // `writtenAt` is when the subagent transcript last changed.
  applySubagentEvents(
    sessionId: string,
    agentId: string,
    info: SubagentInfo,
    events: TranscriptEvent[],
    writtenAt: number,
    now: number,
  ) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    let subagent = session.subagents.get(agentId);
    if (!subagent) {
      subagent = {
        id: agentId,
        name: info.name,
        alias: info.model,
        model: "",
        startedAt: writtenAt,
        lastWriteAt: writtenAt,
        tools: new PendingTools(),
      };
      session.subagents.set(agentId, subagent);
    }
    subagent.name = info.name;
    subagent.alias = info.model;
    subagent.lastWriteAt = Math.max(subagent.lastWriteAt, writtenAt);
    this.emit(sessionId, now);
    for (const event of events) {
      applyEvent(subagent, event);
      this.emit(sessionId, now);
    }
  }

  // Call regularly so subagents turn idle and get removed as time passes.
  tick(now: number) {
    for (const [sessionId, session] of this.sessions) {
      for (const [agentId, subagent] of session.subagents) {
        const quiet = now - subagent.lastWriteAt;
        if (!subagent.tools.current() && quiet >= SUBAGENT_REMOVE_MS) session.subagents.delete(agentId);
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
    const currentTool = session.tools.current();
    const recentWrite = now - session.lastWriteAt < SESSION_BUSY_MS;
    const status: AgentStatus = file.status === "busy" || currentTool !== null || recentWrite ? "busy" : "idle";
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
