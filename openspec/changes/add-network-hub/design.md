## Context

See proposal.md for why. Specs are in `specs/agent-tracking/spec.md` and `specs/factory-scene/spec.md`.

Today one process does everything. `server/index.ts` watches `~/.claude/sessions/` and the transcripts, checks that a session's process is alive with a signal 0 probe, feeds a pure `SessionTracker`, and broadcasts three message types over a WebSocket on `127.0.0.1:4317`: `snapshot`, `session-update`, `session-removed`. The page never talks to that port directly. Vite serves the page on 5173 and proxies `/ws` to the server, and the page reconnects every 2 seconds. Every fact the server uses is local: the files and the process ids exist only on the machine the sessions run on. So another machine can only be shown by running a process there and moving its state across the network.

The page uses `AgentState.cwd` for one thing, the accent color through `accentFor`. The tooltip stopped showing the folder in `add-park-life`. A session's default name is already the last part of `cwd`, computed in `parseSessionFile` from the session file, which the server keeps for itself.

`add-park-life` and `size-lots-by-model` are implemented and merged but not archived. The `factory-scene` deltas here copy their version of "One factory per session" and "Hover details", so archive both before this change.

## Goals / Non-Goals

**Goals:**
- One command per machine. Everyone runs `pnpm dev` with one extra setting and sees the whole park in their own browser.
- Only the hub opens a port to the network. Every other machine makes an outbound connection.
- The tracker, the reader and the page's scene code stay as they are. New behavior lives in two small server modules plus glue in `server/index.ts`.
- The default mode is unchanged, so a solo user notices nothing.

**Non-Goals:**
- Serving the page over the network. Vite stays on localhost.
- Showing local sessions on a spoke while the hub is down.
- Discovery, authentication, or encryption. This is a LAN toy for a trusted office.
- A hub that is also a spoke of another hub.

## Decisions

### Hub and spoke, over the existing message types
A spoke opens one outbound WebSocket to the hub and sends the same three messages it already broadcasts, after one `hello`. The hub treats every message from a spoke as if its own tracker had produced it, after stamping the machine name and prefixing ids. A spoke is therefore a second listener on the tracker, not a new code path through it.

```ts
type RelayMessage = { type: "hello"; machine: string; protocol: 1 } | ServerMessage;
```

- Alternative: the page connects to every machine itself. Rejected: every Mac must open a port, every user keeps a hostname list, and the Vite proxy no longer applies.
- Alternative: Bonjour discovery between servers. Rejected: browsers cannot do mDNS so a proxy is needed anyway, and office wifi often blocks multicast between clients.

### Reporters connect to `/relay` on the hub's one port
The hub keeps one `WebSocketServer` and looks at the request path on connection. Browsers use `/ws` as today, spokes use `/relay`. One port means the Vite proxy on the hub machine keeps working unchanged and there is one number to open in the firewall.

- Alternative: a second port for spokes. Rejected: one more thing to configure and explain.
- Alternative: no path, tell spokes apart by their first message. Rejected: a browser client would sit in an unknown state until it sends nothing, and the path is explicit in logs.

### Two settings, two mechanisms
- Spoke: `HUB=ws://hub-host:4317 pnpm dev`. The server reads `HUB` and starts the relay. `vite.config.ts` reads the same `HUB` and points the `/ws` proxy at it, so the local page shows the hub's park with no page changes. An environment variable is used because the value has to reach two processes started by `concurrently`, which does not pass arguments through.
- Hub: `pnpm hub`, a new script that runs `tsx watch server/index.ts --hub` next to Vite. The flag is fixed text in `package.json`, so it does not need an environment variable and works the same in every shell.
- Machine name: `os.hostname()` up to the first dot, lowercased. `MACHINE=wahid` overrides it, because default Mac names like `macbook-pro-3` tell a team nothing.
- `PORT` overrides 4317. Needed to run a hub and a spoke on one Mac for the end-to-end check, and otherwise unused.

- Alternative: `HUB=listen` for hub mode. Rejected: a magic value in a variable that otherwise holds a URL.

### The hub binds to all interfaces only in hub mode
`HOST` becomes `0.0.0.0` when `--hub` is given, else `127.0.0.1`. macOS asks once whether `node` may accept incoming connections when the application firewall is on. The README says so. Anyone on the network can connect to `/ws` on a hub and read the stream, which the privacy paragraph also says.

### `folder` replaces `cwd` on the wire
`AgentState.cwd` becomes `AgentState.folder`, the last path segment, set by the tracker. Every mode sends the same thing, so a solo user, a spoke and a hub all leak the same small amount, and there is no second code path that strips paths only when relaying. `accentFor` takes the folder name. Two repos with the same folder name on one machine now share a color, which was not the case before and is accepted.

- Alternative: strip the path in the relay only. Rejected: the hub's own sessions would still send full paths to every browser on the network, and local and networked behavior would differ.
- Alternative: hash the path. Rejected: the point of the folder name is that the same repo on two machines gets the same color, and a hash of two different home paths does not.

### `machine` is set by the tracker
`SessionTracker` takes the machine name in its constructor and puts it on every session and subagent state. Subagents carry it too, like they carry `folder`, because the tooltip picks either a hall or a warehouse state and should not have to look up the parent.

- Alternative: stamp it in `index.ts` around `broadcast` and `snapshot`. Rejected: two call sites for one field.

### Hub merge is a pure module
`server/hub.ts` exports a `Hub` class with no sockets:

```ts
class Hub {
  join(machine: string): void;                                   // a machine connected
  apply(machine: string, message: ServerMessage): ServerMessage[]; // what to broadcast
  leave(machine: string): ServerMessage[];                        // removals for its sessions
  remote(): SessionState[];                                       // for a browser snapshot
}
```

It keeps `Map<machine, Set<id>>` and `Map<id, SessionState>`. `apply` prefixes ids as `${machine}/${id}` and sets `machine` on the session and its subagents. A `snapshot` from a machine returns removals for ids it owned that are not in the list, followed by updates for every session in the list. `leave` returns a removal per owned id. The glue in `index.ts` calls these from socket events and broadcasts the results, and a browser snapshot is `tracker.snapshot(now)` concatenated with `hub.remote()`.

If a machine name connects while a socket with that name is still open, the hub closes the old socket first and does not run `leave` for it. The new socket's `snapshot` then reconciles. This covers a spoke that restarts before the hub noticed its old socket was dead.

- Alternative: a second `SessionTracker` per machine fed with fake session files. Rejected: the tracker is built around files and transcripts, the hub only needs to store finished states.

### Relay is a small client with the page's retry rule
`server/relay.ts` exports `startRelay(url, machine, snapshot)`, where `snapshot` is a function that returns the tracker's current list. It connects to `/relay` on the hub, sends `hello`, sends a `snapshot`, and then forwards every tracker message while the socket is open. On close it waits 2 seconds and connects again. Messages produced while disconnected are dropped, which is fine because the next connect starts with a full snapshot. The tracker's constructor listener in `index.ts` gains one line: `relay?.send(message)`.

### Protocol version check
The hub compares `hello.protocol` with its own constant. On a mismatch it logs `machine`, both numbers, and closes with code 1002. The spoke logs the close reason and retries every 2 seconds, so the log on the spoke says what is wrong too. Today the number is `1`. Bump it when `ServerMessage` or `AgentState` change shape in a way an older hub cannot render.

### Page: one body class drives both the sign and the tooltip
`main.ts` counts distinct `machine` values over the lots after every message and toggles `body.classList` `many-machines`. The sign in `lot.ts` gets a second line with the machine name, always rendered, and the tooltip always adds a `machine` line. Both are `display: none` unless `body.many-machines` is set. No lot needs to know about other lots, and a second machine joining flips every sign at once.

- Alternative: pass a flag into every `lot.update`. Rejected: threads one boolean through every update for a purely visual rule.

### Module layout
- `server/types.ts`: `folder` and `machine` on `AgentState`
- `server/session-tracker.ts`: machine in the constructor, folder from `cwd`
- `server/relay.ts`: outbound connection with retry and hello
- `server/hub.ts`: pure merge, `Hub` class
- `server/index.ts`: modes from `--hub`, `HUB`, `MACHINE`, `PORT`; bind address; `/relay` path; socket glue
- `vite.config.ts`: proxy target from `HUB`
- `web/palette.ts`, `web/lot.ts`, `web/tooltip.ts`, `web/main.ts`, `web/style.css`: folder color, machine lines, body class
- `package.json`: `hub` script
- `README.md`: team section, privacy paragraph

### Testing
- Vitest, server: the tracker sets `folder` and `machine` on sessions and subagents. `Hub` returns updates with prefixed ids and the machine name, removals on `leave`, removals for missing ids on a second snapshot, and nothing for a machine it does not know. The relay is tested against an in-process `WebSocketServer` on an ephemeral port: hello then snapshot on connect, forwarded updates, and a reconnect with a fresh snapshot after the server closes the socket.
- Browser with agent-browser: a hub on 4317 and a spoke on `PORT=4318` with `HOME` pointed at a folder that holds test session files, both on this Mac. Lots from both appear with machine names on every sign and in the tooltip, killing the spoke sinks its lots, and stopping the hub and starting it again brings the spoke's lots back.

## Risks / Trade-offs

- [Hub down means an empty page on every spoke, not even their own sessions] → accepted for this change, the pill shows reconnecting. Mirroring the hub stream back to local browsers is the follow-up if this hurts.
- [The reconnect hint says `run pnpm dev` while the real problem is the hub] → accepted, the hint only shows when nothing was ever received.
- [Anyone on the network can read a hub's stream] → the stream holds only names, labels, folder names and machine names, and the README says so. Do not run a hub on a network you do not trust.
- [Two different repos with the same folder name share a color] → accepted, colors were never unique across 8 accents anyway.
- [Version skew between colleagues' checkouts] → protocol number in hello, loud close and log on both sides.
- [A spoke's session names can collide with the hub's] → ids are prefixed, names are display only, and the sign shows the machine when there is more than one.
- [`process.kill(pid, 0)` is unchanged and still local] → each spoke checks its own pids, which is the reason for the hub design.
- [`0.0.0.0` on the hub triggers the macOS firewall prompt] → documented, one click, once.
- [A spoke behind client isolation on guest wifi cannot reach the hub] → out of scope, same as any LAN service.

## Migration Plan

Everyone pulls the same commit before the first hub is started. A hub on the new version refuses a spoke on an older version because the older version never sends `hello`, and the hub closes a `/relay` socket whose first message is not a valid `hello`. Rollback is starting `pnpm dev` without `HUB`, which is the old behavior.
