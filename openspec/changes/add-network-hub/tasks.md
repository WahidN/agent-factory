## 0. Housekeeping

- [x] 0.1 Archive `add-park-life` and `size-lots-by-model` with `openspec archive`, so the main `factory-scene` spec holds the version this change's deltas copy; verify `openspec validate add-network-hub --strict` passes afterwards

## 1. Server: folder and machine on the wire

- [x] 1.1 In `server/types.ts` replace `cwd` with `folder` on `AgentState` and add `machine`; in `server/session-tracker.ts` take the machine name in the constructor, set `folder` to the last part of `file.cwd`, and put both on every session and subagent state; verify Vitest tests pass for the folder of a nested path, a root path, and the machine name on a session and on its subagent
- [x] 1.2 In `server/index.ts` read `MACHINE` or the host name up to the first dot in lowercase, and `PORT` with 4317 as default, and pass the machine name to the tracker; verify `pnpm dev` still lists local sessions and the log shows nothing new

## 2. Server: hub merge

- [x] 2.1 Create `server/hub.ts` with the `Hub` class from design.md (`join`, `apply`, `leave`, `remote`) that prefixes ids with `machine/`, stamps `machine` on sessions and subagents, and reconciles a snapshot against the ids a machine owns; verify Vitest tests pass for an update from a joined machine, a snapshot that drops an id, `leave` returning one removal per id, `remote` after two machines joined, and a message from an unknown machine returning nothing
- [x] 2.2 In `server/index.ts` add the `--hub` flag: bind `0.0.0.0` instead of `127.0.0.1`, route `/relay` connections to the hub and `/ws` to browsers, require a valid `hello` with protocol `1` as the first message and close with 1002 plus a log line otherwise, close an older socket with the same machine name without running `leave`, run `leave` on close, and send browsers `tracker.snapshot(now)` plus `hub.remote()` on connect; verify with `wscat` or a 10 line Node script that a fake spoke's sessions appear in a browser snapshot, disappear when the script exits, and that a wrong protocol number is refused with the logged reason

## 3. Server: relay

- [x] 3.1 Create `server/relay.ts` with `startRelay(url, machine, tracker)`: connect, send `hello` then a full snapshot, forward every tracker message while open, drop messages while closed, and reconnect 2 seconds after a close while logging the close reason; verify Vitest tests pass against an in-process `WebSocketServer` on an ephemeral port for the hello and snapshot order, a forwarded update, and a fresh snapshot after the server closes the socket
- [x] 3.2 In `server/index.ts` start the relay when `HUB` is set and call `relay.send` from the tracker listener; verify a spoke started with `HUB=ws://127.0.0.1:4317` against a local hub shows its sessions in the hub's log with the `machine/` prefix

## 4. Web and dev tooling

- [x] 4.1 In `web/palette.ts` and `web/lot.ts` key the accent color on `folder`; verify Vitest and typecheck pass and two local sessions in the same folder still share a color in agent-browser
- [x] 4.2 In `web/main.ts` toggle `many-machines` on `body` after every message from the distinct `machine` values over the lots; in `web/lot.ts` add a machine line to the sign; in `web/tooltip.ts` add a `machine` line and include it in the render key; in `web/style.css` hide both lines unless `body.many-machines`; verify in agent-browser that a one machine park shows no machine names, that adding a session with another machine name shows them on every sign and in the tooltip, and that removing it hides them again
- [x] 4.3 In `vite.config.ts` point the `/ws` proxy at `process.env.HUB` when set; add the `hub` script to `package.json` that runs `tsx watch server/index.ts --hub` next to Vite; verify `HUB=ws://127.0.0.1:4318 pnpm dev` opens a page whose pill goes live only once something listens on 4318

## 5. Docs

- [x] 5.1 In `README.md` add a team section: `pnpm hub` on one Mac, `HUB=ws://<hub-host>:4317 pnpm dev` on the others, `MACHINE` to name a Mac, the one-time macOS firewall prompt, and how to find the hub's host name; rewrite the privacy paragraph to list folder name and machine name, say the default is still localhost only, and say a hub is readable by anyone on the network

## 6. End-to-end check

- [x] 6.1 On this Mac run `pnpm hub` and a spoke with `PORT=4318 HUB=ws://127.0.0.1:4317 MACHINE=spoke` and `HOME` pointed at a folder holding a copy of `server/tests/fixtures/session.json` with a live pid; verify in agent-browser that lots from both machines appear with machine names on every sign, that killing the spoke sinks its lots within 3 seconds, and that stopping and restarting the hub brings the spoke's lots back without restarting the spoke
- [x] 6.2 Run `pnpm test`, `pnpm typecheck`, and `openspec validate add-network-hub --strict`; verify all pass, and take a screenshot of a two machine park for the README
