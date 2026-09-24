## Why

The park only shows the sessions on this laptop. A team that runs Claude Code on several Macs in the same office cannot see each other's factories. One shared park, one lot per session across all machines, is the point of the tool for a team.

## What Changes

- The server gets two optional modes. Started as a hub, it accepts connections from other machines on the network and merges what they send with its own sessions. Started with a hub address, it connects out to that hub and relays its own session list, updates and removals. Without either, nothing changes: localhost only, own sessions only.
- Every session and subagent carries the name of the machine it runs on. The hub prefixes relayed session ids with that name, so a machine's lots are easy to find in the log, and drops all of a machine's sessions when its connection goes away. A reconnect sends a fresh list, and the hub reconciles against it.
- A relaying machine retries its hub every 2 seconds, the same way the page retries the server. The page on a relaying machine shows the hub's park, so everyone runs `pnpm dev` on their own Mac and sees the whole team.
- The sign above each hall shows the machine name when the park has sessions from more than one machine. In a single machine park the signs look like today. The tooltip gets a machine line under the same rule.
- **BREAKING (wire):** the session state no longer carries the full working folder. It carries `folder`, the last part of the path, and that is what drives the accent color. Sessions in a folder with the same name share a color, also across machines, and the home folder never leaves the machine.
- Reporters and hub agree on a protocol number in the first message. A hub closes a reporter that runs another version and logs why, so two machines on different checkouts fail loudly instead of drawing a broken lot.
- README gets a team section: how to start a hub, how to point a spoke at it, the one-time macOS firewall prompt, and an updated privacy paragraph. The paragraph now lists folder name and machine name, and says that a hub is reachable by anyone on the network.

Not in this change: serving the page itself over the network, showing your own sessions while the hub is down, discovery with Bonjour, authentication or encryption, and cloud sessions from claude.ai/code, which have no local files.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `agent-tracking`: "Discover running sessions" exposes the folder name and machine name instead of the working folder; "Short tool labels only" also rules out full paths; "Local and read-only" becomes local by default, with a hub accepting network connections; new requirements "Relay to a hub" and "Merge sessions as a hub".
- `factory-scene`: "One factory per session" colors by folder name and shows the machine name on the sign when more than one machine is present; "Hover details" adds the machine line under the same rule.

## Impact

- Server: `server/types.ts` (`folder` replaces `cwd`, new `machine`), `server/session-tracker.ts` (folder base name, machine name from the constructor), new `server/relay.ts` (outbound connection with retry), new `server/hub.ts` (pure merge of reporter messages into broadcasts), `server/index.ts` (modes, bind address, reporter path, disconnects). Tests for the tracker fields, the hub merge and the relay handshake.
- Web: `web/palette.ts` and `web/lot.ts` (accent by folder, machine line on the sign), `web/tooltip.ts` (machine line), `web/main.ts` (counts machines, toggles a body class), `web/style.css`, `vite.config.ts` (proxy target follows the hub address).
- Docs: `README.md`.
- Wire format: `AgentState.cwd` is gone, `AgentState.folder` and `AgentState.machine` are new. Reporter to hub: a `hello` message with machine name and protocol `1`, then the existing server messages unchanged.
- The two unarchived changes `add-park-life` and `size-lots-by-model` are implemented and merged. This change's `factory-scene` deltas build on their version of "One factory per session" and "Hover details", so they should be archived first.
