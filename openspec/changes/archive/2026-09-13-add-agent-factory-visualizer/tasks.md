## 1. Project setup

- [x] 1.1 Create `package.json` with TypeScript, Vite, Vitest, `three`, `ws`, and a runner so `npm run dev` starts server and Vite together; verify `npm install` succeeds
- [x] 1.2 Add `tsconfig.json`, `vite.config.ts` with a `/ws` proxy to `127.0.0.1:4317`, and `web/index.html`; verify `npx vite` serves a blank page without errors
- [x] 1.3 Add `.gitignore` for `node_modules` and build output; verify `npm test` runs Vitest with zero tests found and exits cleanly

## 2. Claude file reader (server/claude-reader.ts)

- [x] 2.1 Write hand-made fixtures in `server/tests/fixtures/`: running tool, finished tool, half-written last line, unknown line types, subagent transcript, session file, subagent meta file; verify each file matches the formats described in design.md
- [x] 2.2 Implement `projectDirFor(cwd)` and `parseSessionFile(json)`; verify unit tests pass for path conversion and for valid, missing-field, and invalid JSON session files
- [x] 2.3 Implement `parseTranscriptChunk(text)` returning events and remainder; verify tests pass for tool start, tool end, half-written line carried as remainder, and unknown lines skipped
- [x] 2.4 Implement `toolTarget(name, input)`; verify tests pass for file base name, 40 character truncation of commands and patterns, and empty label for other tools, and that no prompt or file content is ever returned
- [x] 2.5 Implement `parseSubagentMeta(json)`; verify tests pass for a valid meta file and an invalid one

## 3. Session tracker (server/session-tracker.ts)

- [x] 3.1 Implement per session state that applies tool events and status updates and exposes `SessionState`; verify tests pass showing the current tool after each step of a start, start, end, end event sequence
- [x] 3.2 Add subagent tracking with a fake clock: busy when a tool is running or written in the last 5 seconds, removed after 60 seconds quiet; verify tests pass for each timing boundary
- [x] 3.3 Emit change notices only when a session's state actually changed; verify a test that repeated identical updates produce one notice

## 4. Server glue (server/index.ts)

- [x] 4.1 Read `~/.claude/sessions/`, drop sessions with dead pids, and re-check every 5 seconds; verify by logging the session list and comparing it to `ps` output for running `claude` processes
- [x] 4.2 Tail each transcript: last 64 KB on first sight, then from the stored byte offset, restarting if the file shrinks, and retry when a missing transcript appears; verify the logged current tool for this session changes while a tool runs here
- [x] 4.3 Watch the sessions folder, project folders, and `subagents/` folders with a 50 ms debounce per file; verify starting a new `claude` session and running a subagent both show up in the log
- [x] 4.4 Start a WebSocket server on `127.0.0.1:4317` sending `snapshot`, `session-update`, and `session-removed`; verify with a small script that a snapshot arrives on connect and updates arrive when a session changes
- [x] 4.5 Verify read-only and local-only: grep the server code for write, rename, and delete calls on `~/.claude` paths (none expected), and confirm `lsof -i :4317` shows the server listening only on `127.0.0.1`

## 5. Scene foundation (web/)

- [x] 5.1 In `web/scene.ts`, set up renderer, angled camera, `OrbitControls` with a polar angle limit, sun and ambient light with shadows, tiled ground, and the render loop; verify in the browser that the ground renders, drag and scroll work, and the camera cannot go below ground
- [x] 5.2 In `web/main.ts`, connect to `/ws`, retry every 2 seconds, and show the "live" or "reconnecting..." pill plus the `run npm run dev` hint; verify in the browser by stopping and starting the server
- [x] 5.3 Add plot assignment by start time that never moves existing plots and frees plots on removal; verify with a unit test that adding and removing sessions keeps other plots unchanged

## 6. Factory (web/factory.ts)

- [x] 6.1 Build the factory from primitives: hall, roof colored by a hash of `cwd`, chimney, conveyor, robot arm, furnace door, radar dish, wall gear, and a canvas texture name sign; verify in the browser that each session gets a labeled factory and same-folder sessions share a roof color
- [x] 6.2 Implement the activity model: per part value easing over 0.3 seconds with a 0.6 second minimum hold after a tool starts; verify with a unit test using a fake clock that a 200 ms tool keeps its part active for at least 0.6 seconds
- [x] 6.3 Map tool names to parts (arm, furnace, radar, gear) and drive idle and busy visuals, using a pooled set of smoke spheres; verify in the browser that this session's factory shows the right machine while running Bash, Read, and Edit
- [x] 6.4 Add the sink-into-ground removal animation; verify in the browser by closing a `claude` session

## 7. Subagents and tooltip

- [x] 7.1 In `web/subagent.ts`, build small workshops with a road on the parent's plot, grow and shrink animations, the same activity rules, a max of 4, and an overflow count on the parent sign; verify in the browser by starting a task that spawns subagents
- [x] 7.2 In `web/tooltip.ts`, raycast on pointer move and show name, folder, status, and tool with label, hidden when off target; verify in the browser by hovering a busy factory and a workshop

## 8. End-to-end check

- [x] 8.1 With several real sessions running, use agent-browser to confirm: all sessions appear, idle ones are still, the active one animates with the right machine, tooltips are correct, and a page reload restores everything; take a screenshot as proof
- [x] 8.2 Run `npm test` and `openspec validate add-agent-factory-visualizer --strict`; verify both pass
