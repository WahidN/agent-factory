// Shared between server and web. Only summaries: never prompts or file contents.
// The wire format is deliberately small and flat. Everything that could carry a
// path, a command or a prompt is redacted on the reporter, before it is sent.

export type AgentStatus = "busy" | "idle";

// The whole wire format. Seven fields, about 120 bytes per session.
export type AgentState = {
  id: string;
  user: string; // who runs the session, from USER in the reporter's env
  project: string; // last part of the working folder, never the full path
  model: string; // model id from the transcript, empty until the first assistant message
  status: AgentStatus;
  subagents: number; // how many subagents are alive, not which ones
  startedAt: number;
};

// Kept as a separate name so call sites read the same as before. A session no
// longer carries nested agents, so the two types are identical.
export type SessionState = AgentState;

// `batch` wraps the updates from one tick. A snapshot of 150 sessions used to
// arrive as 150 separate messages, and the page rebuilt every road, kerb, lamp
// and tree of the park after each one.
export type ServerMessage =
  | { type: "snapshot"; sessions: SessionState[] }
  | { type: "session-update"; session: SessionState }
  | { type: "session-removed"; id: string }
  | { type: "batch"; messages: PlainMessage[] };

// What a batch may hold: everything except another batch, so it cannot nest.
export type PlainMessage =
  | { type: "snapshot"; sessions: SessionState[] }
  | { type: "session-update"; session: SessionState }
  | { type: "session-removed"; id: string };
