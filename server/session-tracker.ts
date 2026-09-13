// Holds state per session and subagent. No file system access and no clock of
// its own: callers pass `now`, so timing rules can be tested with a fake clock.

import type { SessionFile, ToolEvent } from "./claude-reader.ts";
import type { AgentState, CurrentTool, ServerMessage, SessionState } from "./types.ts";

export const SUBAGENT_BUSY_MS = 5_000;
export const SUBAGENT_REMOVE_MS = 60_000;

type Listener = (message: ServerMessage) => void;

// Tool calls without a result yet, in the order they started.
class PendingTools {
  private pending = new Map<string, CurrentTool>();

  apply(events: ToolEvent[]) {
    for (const event of events) {
      if (event.kind === "tool_start") this.pending.set(event.id, { name: event.name, target: event.target });
      else this.pending.delete(event.id);
    }
  }

  current(): CurrentTool | null {
    let last: CurrentTool | null = null;
    for (const tool of this.pending.values()) last = tool;
    return last;
  }
}

type Subagent = {
  id: string;
  name: string;
  startedAt: number;
  lastWriteAt: number;
  tools: PendingTools;
};

type Session = {
  file: SessionFile;
  tools: PendingTools;
  subagents: Map<string, Subagent>;
};

export class SessionTracker {
  private sessions = new Map<string, Session>();
  private lastSent = new Map<string, string>();

  constructor(private listener: Listener) {}

  upsertSession(file: SessionFile, now: number) {
    const existing = this.sessions.get(file.sessionId);
    if (existing) existing.file = file;
    else this.sessions.set(file.sessionId, { file, tools: new PendingTools(), subagents: new Map() });
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
  // still reaches clients as two updates instead of vanishing.
  applySessionEvents(sessionId: string, events: ToolEvent[], now: number) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    for (const event of events) {
      session.tools.apply([event]);
      this.emit(sessionId, now);
    }
  }

  // `writtenAt` is when the subagent transcript last changed.
  applySubagentEvents(
    sessionId: string,
    agentId: string,
    name: string,
    events: ToolEvent[],
    writtenAt: number,
    now: number,
  ) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    let subagent = session.subagents.get(agentId);
    if (!subagent) {
      subagent = { id: agentId, name, startedAt: writtenAt, lastWriteAt: writtenAt, tools: new PendingTools() };
      session.subagents.set(agentId, subagent);
    }
    subagent.name = name;
    subagent.lastWriteAt = Math.max(subagent.lastWriteAt, writtenAt);
    this.emit(sessionId, now);
    for (const event of events) {
      subagent.tools.apply([event]);
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
    const subagents: AgentState[] = [...session.subagents.values()].map((subagent) => {
      const currentTool = subagent.tools.current();
      const recent = now - subagent.lastWriteAt < SUBAGENT_BUSY_MS;
      return {
        id: subagent.id,
        name: subagent.name,
        cwd: file.cwd,
        status: currentTool || recent ? "busy" : "idle",
        currentTool,
        startedAt: subagent.startedAt,
      };
    });
    return {
      id: file.sessionId,
      name: file.name,
      cwd: file.cwd,
      status: file.status,
      currentTool: session.tools.current(),
      startedAt: file.startedAt,
      subagents,
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
