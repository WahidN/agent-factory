## Why

Several Claude Code sessions often run on this laptop at the same time, some for days. There is no quick way to see which ones are running, which are working, and what they are doing without switching between terminals.

## What Changes

- New local Node server that reads Claude Code session and transcript files under `~/.claude/` (read-only) and pushes a short summary of each session to the browser over a WebSocket.
- New Vite + Three.js web page that shows each running session as a low-poly 3D factory.
- Factories animate while their agent is busy, and a different machine lights up per tool type (edit, shell, search, other).
- Subagents show up as small workshops next to their parent factory.
- Hover tooltip with session name, folder, status, and current tool.
- Out of scope for this change: other AI tools, history or cost stats, controlling agents from the page, cloud or remote sessions, a "waiting for permission" state.

## Capabilities

### New Capabilities
- `agent-tracking`: discovering running Claude Code sessions and subagents, working out their status and current tool from local files, and streaming that state to clients.
- `factory-scene`: the 3D scene that turns agent state into factories, workshops, animations, and a tooltip.

### Modified Capabilities

None. This is a new project.

## Impact

- New project at `/Volumes/Based/Projects/agent-factory` with `server/` and `web/` folders.
- Dependencies: `three`, `ws`, `vite`, `typescript`, `vitest`, and a runner to start server and Vite together.
- Reads `~/.claude/sessions/` and `~/.claude/projects/`. These are internal Claude Code files, so a Claude Code update may change their format.
- Opens a WebSocket server on `127.0.0.1:4317`, reachable only from this laptop.
