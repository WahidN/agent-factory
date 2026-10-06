// Shared between server and web. Only summaries: never prompts or file contents.
// The wire format is deliberately small and flat. No prompt, command or full
// path leaves the reporter, but `project` is the last folder name of the
// session's working directory and every viewer of the park sees it.

export type AgentStatus = "busy" | "idle";

// The whole wire format, bar the token total below. Seven fields, and nothing
// else ever goes over the line. Measured as JSON: 121 bytes for a short id and
// a short model name, 180 for a session id that is a UUID and a dated model id.
export type AgentState = {
  id: string;
  user: string; // who runs the session, from USER in the reporter's env
  project: string; // last part of the working folder, never the full path
  model: string; // model id from the transcript, empty until the first assistant message
  status: AgentStatus;
  subagents: number; // how many subagents are alive, not which ones
  startedAt: number;
};

// A second name for the same type: the web code uses both. `machineTokens` is
// the season token total of the machine, the same on every session it runs. It
// is optional on the wire: a reporter on protocol 2 does not send it, and its
// sessions show no total until that machine updates.
export type SessionState = AgentState & { machineTokens?: number };

// What a batch may hold: everything except another batch, so it cannot nest.
export type PlainMessage =
  | { type: "snapshot"; sessions: SessionState[] }
  | { type: "session-update"; session: SessionState }
  | { type: "session-removed"; id: string };

// `batch` wraps the updates from one tick (see batcher.ts).
//
// `server-mode` tells a browser which kind of server it reached, the one thing
// the page cannot work out for itself: the hub serves the same bundle as a
// local server. It sits here and deliberately not in PlainMessage, because a
// reporter relays plain messages up to the hub and the hub accepts them by
// name (hub.ts). A variant that only exists on the way down can never travel
// up that path, and never lands inside a batch either.
// Everything that says something about sessions, batched or not. The park is
// built from these alone.
export type ParkMessage = PlainMessage | { type: "batch"; messages: PlainMessage[] };

// `kudos` is a browser's cheer for a user, passed on to every browser. Like
// server-mode it is not a PlainMessage: it is not park state, never batched,
// never relayed, so PROTOCOL stays as it is.
export type ServerMessage = ParkMessage | { type: "server-mode"; hub: boolean } | { type: "kudos"; user: string };

// The only thing a browser sends on /ws (see kudos.ts for the limits).
export type ViewerMessage = { type: "kudos"; user: string };
