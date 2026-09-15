// Shared between server and web. Only summaries: never prompts or file contents.

export type AgentStatus = "busy" | "idle";

export type CurrentTool = { name: string; target: string };

export type AgentState = {
  id: string;
  name: string;
  folder: string; // last part of the working folder, never the full path
  machine: string; // short host name of the machine the session runs on
  status: AgentStatus;
  currentTool: CurrentTool | null;
  startedAt: number;
  model: string; // model id from the transcript, empty until the first assistant message
};

export type SessionState = AgentState & { subagents: AgentState[] };

export type ServerMessage =
  | { type: "snapshot"; sessions: SessionState[] }
  | { type: "session-update"; session: SessionState }
  | { type: "session-removed"; id: string };
