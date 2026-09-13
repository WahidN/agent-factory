## Context

See proposal.md for why. Behavior is defined in `specs/agent-tracking/spec.md` and `specs/factory-scene/spec.md`.

Claude Code writes the data needed to disk, but in internal formats with no public API:

- `~/.claude/sessions/<pid>.json`: one per running session. Fields used: `pid`, `sessionId`, `cwd`, `name`, `status` (`busy` or `idle`), `startedAt`.
- `~/.claude/projects/<project-dir>/<sessionId>.jsonl`: transcript. `<project-dir>` is `cwd` with every `/` replaced by `-` (for example `/Volumes/Based/Projects` becomes `-Volumes-Based-Projects`). Lines with `type: "assistant"` have `message.content` blocks; a `tool_use` block has `id`, `name`, `input`. A later `type: "user"` line has a `tool_result` block whose `tool_use_id` matches.
- `~/.claude/projects/<project-dir>/<sessionId>/subagents/agent-<id>.jsonl`: subagent transcript, same format.
- `~/.claude/projects/<project-dir>/<sessionId>/subagents/agent-<id>.meta.json`: fields used: `name`, `agentType`, `description`.

Transcripts can be large (17 MB seen on this laptop). A browser page cannot read local files, so a local process has to read them.

## Goals / Non-Goals

**Goals:**
- Keep all knowledge of Claude Code's file formats in one module, so a format change is a one-file fix.
- Keep that module free of file system and network code so it can be unit tested with small fixture strings.
- Smooth animation with dozens of factories.

**Non-Goals:**
- Supporting other agent tools, or a plugin system for them.
- Persisting anything to disk.
- Production build or deployment. This runs with `npm run dev` on one laptop.

## Decisions

### Two processes: Node server + Vite page
The server reads files and pushes state; the page draws it. Vite proxies `/ws` to the server so the page connects to its own origin. `npm run dev` starts both with `concurrently`, without its kill-others flag, so if the server stops the page stays up and shows "reconnecting...".
- Alternative: a desktop wrapper (Electron) that can read files and draw in one process. Rejected: much heavier, and a browser tab is enough.

### Learn state by watching files, not through hooks
The server watches `~/.claude/sessions/` and each active project folder with Node's built-in `fs.watch`, debounced 50 ms per file. The project folder watch is recursive, so it also sees `subagents/` folders, including ones created after the session started. A 5 second timer also checks that each session's process is alive (`process.kill(pid, 0)`), since a crashed session can leave its file behind, and re-reads anything a missed file event skipped. Subagent transcripts quiet for 60 seconds or more are not read, so a removed subagent is not added back by that timer.

If the transcript is not at the path derived from `cwd`, the server looks for `<sessionId>.jsonl` in every project folder, in case the folder naming rule differs for paths with dots or spaces.
- Alternative: Claude Code `PreToolUse` / `Stop` hooks posting to the server. Rejected: hooks load only at session start, so sessions already running would be invisible, and it changes global Claude Code config and adds work to every tool call even when the visualiser is closed.
- Alternative: polling every 2 seconds. Rejected: adds seconds of lag and misses short tool calls.

### Push over WebSocket
One open connection; the server sends only when something changes. Library: `ws`. Server binds to `127.0.0.1:4317`, which is what makes it unreachable from other devices.

Messages, server to client only:
- `{ type: "snapshot", sessions: SessionState[] }` on connect
- `{ type: "session-update", session: SessionState }`
- `{ type: "session-removed", id: string }`

```ts
type AgentState = {
  id: string;
  name: string;
  cwd: string;
  status: "busy" | "idle";
  currentTool: { name: string; target: string } | null;
  startedAt: number;
};
type SessionState = AgentState & { subagents: AgentState[] };
```

Sending the whole session on each update (not a diff) keeps the client simple. Sessions are small, so the cost does not matter.

The tracker sends an update after each tool event, not after each read. Otherwise a tool that starts and ends within one 50 ms debounce window would never reach the browser, and the "short tool calls stay visible" rule could not work. Identical consecutive states are still sent only once.

- Alternative: Server-Sent Events. Would also work since traffic is one-way, but WebSocket reconnect handling is equally simple and `ws` is the more familiar tool.

### Tail transcripts from a byte offset
On first sight, read the last 64 KB, drop the first partial line, and replay tool events to find the running tool. Then remember the byte offset and read only new bytes on each change. A chunk parser returns complete events plus the unfinished last line as a remainder, which is prepended to the next read. If the file shrinks, start over from the last 64 KB.
- Alternative: read the whole file on each change. Rejected: a 17 MB file on every tool call is wasteful.
- Trade-off: if a tool started more than 64 KB before the end of the file and is still running, it is missed until the next tool call. Acceptable, since the next tool call corrects it.

### Server module layout
- `server/claude-reader.ts`: pure functions for all format knowledge: `projectDirFor(cwd)`, `parseSessionFile(json)`, `parseTranscriptChunk(text)` returning `{ entries: ToolEvent[]; remainder: string }`, `toolTarget(name, input)`, `parseSubagentMeta(json)`.
- `server/session-tracker.ts`: state per session and subagent. Takes parsed events and timestamps as input, so busy and removal timing can be tested with a fake clock.
- `server/index.ts`: file watching, pid checks, tail reads, WebSocket server. Glue only.

### Tool type mapping
One lookup table in the web code: `Edit`, `Write`, `NotebookEdit` → arm; `Bash` → furnace; `Read`, `Grep`, `Glob` → radar; anything else → gear. The server sends raw tool names so the mapping can change without touching the server.

### Plain Three.js, no UI framework
The page is one canvas, a tooltip, and a status pill. React would add a layer without solving a problem here. Built from Three.js primitives only (boxes, cylinders, cones) plus canvas textures for signs, so there are no model files to load.

Web modules:
- `web/main.ts`: renderer, WebSocket client with reconnect, status pill.
- `web/scene.ts`: camera, `OrbitControls` with a polar angle limit, sun + ambient light with shadows, ground tiles, plot assignment, render loop.
- `web/factory.ts`: builds and animates one factory from a `SessionState`.
- `web/subagent.ts`: builds and animates one workshop from an `AgentState`.
- `web/tooltip.ts`: raycasting on pointer move, HTML tooltip.

### Animation model
Each animated part has an `activity` value from 0 to 1 that eases toward its target over 0.3 seconds, plus a `holdUntil` time set 0.6 seconds after its tool starts. The target stays 1 until both the tool has ended and `holdUntil` has passed. This one mechanism covers fades and the minimum visible time for short tool calls.

### Performance
Geometries and materials are shared per part type. Smoke uses a fixed pool of reused spheres. No objects are created per frame.

### Testing
- Vitest unit tests for `claude-reader.ts` with small hand-written fixtures (not copies of real transcripts).
- Vitest tests for `session-tracker.ts` with a fake clock.
- The scene is checked in the browser with agent-browser against real running sessions.

## Risks / Trade-offs

- [Claude Code changes its internal file format] → All format knowledge is in `claude-reader.ts` with fixture tests, so a break shows up in one place and is fixed in one file.
- [`fs.watch` on macOS can report duplicate events or miss events for rapidly replaced files] → Per file debounce, reads based on the current file size rather than on event details, and the 5 second pid check as a safety net.
- [Subagent "finished" is a guess based on 60 seconds without writes] → A long thinking pause cannot remove a workshop too early; the cost is that finished workshops linger for up to a minute.
- [Transcripts contain sensitive content] → Only tool name and short label leave the server, and the server binds to `127.0.0.1`.
- [Many sessions make the town large] → Plots grow outward on a square grid; camera zoom range covers about 25 plots. Larger counts are out of scope for now.
