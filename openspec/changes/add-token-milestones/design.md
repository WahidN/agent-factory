## Context

See proposal.md for why. Specs are in `specs/agent-tracking/spec.md` and `specs/factory-scene/spec.md`.

The server already tails every running transcript and parses every complete line in `server/claude-reader.ts`, where all knowledge of Claude Code's file formats lives. It reads only the last 64 KB of a transcript on first sight. It never writes under `~/.claude/`. The tracker stamps `machine` on every state, and the hub spreads a relayed state through with the machine name and a prefixed id.

Every assistant line in a transcript carries `message.usage` with `input_tokens`, `output_tokens`, `cache_creation_input_tokens` and `cache_read_input_tokens`, plus `message.id`, a top level `requestId` and a top level `uuid`. Streaming writes the same message id more than once while the output grows. A resumed session copies earlier lines into a new file. PokeTokenBar reads the same files and counts a message once by keeping the largest total per `message.id|requestId`; this design copies that rule so the number matches what people see there and in ccusage.

Measured on this Mac: 516 transcripts, 423 MB, 47070 usage lines of which 23534 are unique messages, parsed in 2.2 s by a Node script that only JSON parses lines containing both `"usage"` and `"assistant"`. Lifetime total 4.43B, of which 4.34B are cache reads. Claude Code's own `~/.claude/stats-cache.json` has per model totals but was last computed months ago and names models no session runs today, so it is not a usable source.

On the page, `Lot.buildStructure` bakes everything sized by the tier into one static mesh through `StaticBuilder` and rebuilds it in place when the model changes. `disposeStructure` disposes the geometry of every mesh in the structure, which is why the parked truck, a clone of a shared template, lives outside it today. The yard is 40 x 40 with the hall in the back left, the dock at x -7, the car bays at x -0.3..7.5 and z 3.9..8.1, the truck bay between the yellow lines at z 4.1 and 7.6, the walkway at z 9, the warehouse slots at z 11.5..16.5, the searchlight tower at (-17, 12) and the gate in the right fence at z 6..12.

`add-network-hub` is merged but not archived. The `factory-scene` deltas here copy its version of "One factory per session" and "Hover details", so archive it before this change.

## Goals / Non-Goals

**Goals:**
- One number per machine, counted from a fixed season start, computed once at start and kept live from the lines the server already reads.
- Every extra is a static bake in the lot's structure, so it costs nothing per frame. Only the turbine and the blimp tick.
- The server stays read only under `~/.claude/`.
- A solo user and a hub user get the same behavior, and the hub needs no merge logic for the new field.

**Non-Goals:**
- A per session total. The extras belong to the user, not to one session.
- Other transcript roots (`~/.config/claude`, `CLAUDE_CONFIG_DIR`, Claude Desktop stores). The server already hardcodes `~/.claude`.
- Cost in dollars, per model breakdowns, or daily numbers.
- Animating the helicopter rotor or the cars with activity.

## Decisions

### Count like PokeTokenBar
Sum the four usage fields of every assistant line. Key each message by `message.id|requestId`, and keep the largest total per key. When both are empty, use the line's `uuid` so id-less lines never collapse into one key. `<synthetic>` lines have no usage and add nothing. `output_tokens_details.thinking_tokens` is a subset of output and is ignored.

- Alternative: only fresh tokens (input, output, cache write). Rejected: 88M instead of 4.4B on this Mac, and not the number people see in PokeTokenBar or ccusage.
- Alternative: `~/.claude/stats-cache.json`. Rejected: only refreshed when the user runs `/stats`, stale for months here.
- Alternative: count the first copy of a message. Rejected: streaming logs a partial output first, which undercounts.

### Count from a fixed season start
Only messages written at or after `SEASON_START`, `2026-09-16T00:00:00Z`, count. The constant lives in `server/usage-ledger.ts`, the ledger takes it in its constructor, and `add(id, total, at)` returns false for anything older. A line whose timestamp cannot be parsed has `at` 0 and is dropped too; every Claude Code transcript line carries a timestamp, so nothing real is lost. The counting rule is otherwise unchanged, so the number is still the PokeTokenBar number, only from a date.

The lifetime total on this Mac was 4.43B against a ladder that ends at 5B, so a lifetime count hands a heavy user the whole ladder on day one, and a colleague who joins later can never catch up. A shared date gives everyone the same starting line, and the number means the same on every machine: tokens since 16 September. At the measured 600M per week the bikes arrive within hours, the helicopter after about 12 days and the blimp after about 8 weeks. A new season is a change of the constant, and everyone resets together.

- Alternative: a marker file written on the first run, counting since the factory was installed. Rejected: state on disk, and two machines that installed a week apart are no longer comparable.
- Alternative: remember the lifetime total on the first run and show the difference. Rejected: a deleted or missed transcript makes the number jump or go negative.
- Alternative: a rolling window, for example the last 30 days. Rejected: extras would disappear again, which does not feel earned.
- Alternative: filter in `server/index.ts` before the ledger. Rejected: the rule belongs with the counting, and the pure module is where it is tested.

### Usage is a transcript event, the ledger is a pure module
`parseTranscriptChunk` gains a `usage` event: `{ kind: "usage"; id: string; total: number; at: number }`, emitted for every assistant line with a usage block. A new `parseUsageLine(line)` in `server/claude-reader.ts` returns the same for one line, with the `"usage"` and `"assistant"` substring check before any JSON parse, for the scan.

`server/usage-ledger.ts` exports a `UsageLedger` with `add(id, total, at): boolean` (true when the sum changed, always false before the season start) and `total(): number`. It holds `Map<id, total>` and the season start it was given. No files, no clock.

In `server/index.ts` the events from a tail read are split: usage events go to the ledger, the rest to the tracker as today. When the ledger's total changed, `tracker.setMachineTokens(total, now)` is called.

- Alternative: the tracker owns the ledger. Rejected: the tracker is per session state; the total is per machine.
- Alternative: parse usage in a separate pass over the same bytes. Rejected: the chunk is already parsed line by line.

### One background scan at start, no cache file
After the server listens and the first `refreshSessions` has run, `scanUsage()` walks `~/.claude/projects/` for every `.jsonl` and streams each file line by line with `readline` over `createReadStream`, feeding `parseUsageLine` into the ledger. Streaming yields between chunks, so the event loop keeps serving sockets and file events. The total is published to the tracker once, when the scan is done, so every lot rebuilds once instead of per file. From then on the tail keeps the total live.

The tail and the scan overlap on the last 64 KB of every running transcript. The ledger's keep-max rule makes that harmless.

A transcript first seen by the tail from the middle (`fromMiddle` true) gets a full read of that one file in the background. This covers a session that started while the server was running and whose file is already large on first sight, for example a resumed session that copied its history.

- Alternative: scan before listing sessions. Rejected: the park would stay empty for seconds on a heavy disk.
- Alternative: a cache file keyed on path, mtime and size like PokeTokenBar. Rejected: the server writes nothing under `~/.claude/`, a cache elsewhere adds invalidation logic, and the saving is a few seconds per start.
- Alternative: re-run the scan on a timer. Rejected: finished transcripts do not change, running ones are tailed.

### The total rides on every session state
`SessionState` gains `machineTokens: number`. The tracker keeps one number and puts it on every session in `stateOf`. `setMachineTokens` stores it and emits every session; the emit dedup drops sessions whose serialized state did not change. The hub spreads the field through untouched, the relay sends states as they are, and the page reads `session.machineTokens`. `PROTOCOL` goes to 2, so a hub and a spoke on different versions fail loudly instead of drawing empty yards for one machine.

- Alternative: a new `machine-usage` message. Rejected: the hub, the relay's type list, the page handler and the connect snapshot all need code, for one number that already has a carrier.
- Alternative: put it on `AgentState` so subagents carry it too. Rejected: the tooltip only shows it on halls, and warehouses never need it.

### Ladder as data, one builder per step
`web/milestones.ts` exports:

```ts
export const MILESTONES: readonly number[] = [10e6, 25e6, 50e6, 100e6, 250e6, 500e6, 750e6, 1e9, 2.5e9, 5e9];
export function milestoneIndex(tokens: number): number; // rows reached, 0..10
export function buildMilestones(builder: StaticBuilder, count: number, ctx: MilestoneContext): Animated[];
```

`MilestoneContext` carries the accent material, the hall footprint for the blimp, and the session id as a color seed. Each row is a function that adds boxes and cylinders to the builder, in the style of `addParkedCars` and `createTruck`. The turbine and the blimp return an `Animated` object with a `group` and `tick(dt)`, like `Searchlight`, and are added to the structure so `disposeStructure` cleans them up.

`Lot` keeps `builtMilestone`. `update` rebuilds when `tierFor(model)`, `model` or `milestoneIndex(state.machineTokens)` differs from what was built. `Lot.tick` ticks the animated extras.

- Alternative: add and remove extras one by one without a rebuild. Rejected: the structure is one merged mesh, and a rebuild in place already exists for model switches.

### Parked vehicles are baked, so the truck parts move out of the template
`addParkedCars(builder, seed, count)` takes the number of cars, 0 to 3, and keeps the bay lines and the color hash as they are. The truck's part list moves out of `createTruck` into `addTruckParts(b)`, used by the template for the road trucks and by the 500M row to bake a parked truck into the structure. The parked truck clone in the `Lot` constructor goes away.

`movingCarCount(lotBusy, busySubagents)` becomes `lotBusy ? Math.min(6, busySubagents) : 0`. The truck rule in `Lot.traffic()` stays.

### Placement
Everything sits in yard space that is free on all four tiers. Coordinates are lot local, yard ground at `YARD_Y`.

| Row | Position | Clear of |
|---|---|---|
| bike rack | rack at (3.3, -3.3), 1.3 long along x, 3 bikes along z toward +z | people door x 0.9..2.1, hatch x up to 2.5, worker routes starting at (1.5, -3.3) and (6, -3.4), hall corner x 4 |
| cars | existing bays at x 1, 3.6, 6.2 on z 6, nose to the hall | unchanged from today |
| flagpole | (18.3, 13.5), 9 high, flag 2 x 1.2 in the accent colour | warehouse slot 3 x up to 15.5, its route z 17.6, the sign from x 3 on z 18.8, walkway route z 9.5, gate posts at z 6 and 12 |
| coffee cart, picnic table | cart at (11, 7.3), 2.6 x 1.6; table at (15.5, 7.3), 1.8 x 1.6 | huge cooling tower edge z about 4.5 at x 11, walkway decals z 9, gate |
| truck | (-9, 5.8) facing +x, as today | truck bay lines |
| EV chargers, sports car | car at (-13, 9.6) along x, 3.8 x 1.7 and lower than a car; chargers at (-12, 11) and (-14.5, 11), 0.4 wide, 1.4 high | truck bay line z 7.6, warehouse slot 0 from x -11.5 and z 11.5, searchlight tower base x up to -16.2 |
| helipad, helicopter | on the hall roof in the back left corner: painted circle radius 2 with a white H at (x0 + 3.8, z0 + 2.1) from the roof corner; body at the center with the nose to the back, rotor radius 3 at 2.4 above the roof, tail toward the front | the corner vent at (2, 2.5) from the corner (x up to 2.5), the skylight from x 5.5, the roof letters at z 6.75, the parapet 0.4 wide; the same corner is free on the small roof because roof items are placed from that corner and a smaller roof only drops the far ones; the rotor passes above vents (1.0 high) and skylights (1.2 high) |
| wind turbine | mast at (-18.3, 5.5), 12 high; hub at 13; 3 blades radius 4 turning in a plane facing +z, so they sweep above the fence and the road | truck from x -15, pad center 6.7 away, searchlight tower z 12 |
| blimp | hull 10 long and 3.5 across along x at y 30 over the hall center; 4 fins; gondola; a thin tether down to the roof; bobs 0.6 over 6 s | stacks top out at 17 plus smoke |

### Tooltip and short format
`shortTokens(n)` in `web/sign-text.ts`: units k, M, B; 1 decimal below 10 of a unit, none above; no trailing `.0`. So 950, 12k, 2.5M, 408M, 4.4B, 25B. The tooltip adds `line("tokens", shortTokens(n) + " tokens")` when the hovered state has `machineTokens`, which only a hall's `SessionState` has.

### Module layout
- `server/types.ts`: `machineTokens` on `SessionState`
- `server/claude-reader.ts`: `usage` event, `parseUsageLine`
- `server/usage-ledger.ts`: `UsageLedger`
- `server/session-tracker.ts`: `setMachineTokens`, field in `stateOf`
- `server/index.ts`: scan, split of events, full read on first sight from the middle
- `server/hub.ts`: `PROTOCOL = 2`
- `web/milestones.ts`: ladder, lookup, builders, animated turbine and blimp
- `web/lot.ts`: no default vehicles, rebuild key, tick extras
- `web/traffic.ts`, `web/machines.ts`: car count, shared truck parts
- `web/park-layout.ts`: `movingCarCount`
- `web/sign-text.ts`, `web/tooltip.ts`: `shortTokens`, token line
- `README.md`: state table, milestones section

### Testing
- Vitest, server: a fixture `usage.jsonl` with a message logged twice with growing output, a line without usage, a user line and a `<synthetic>` line; `parseUsageLine` and `parseTranscriptChunk` return the expected events; `UsageLedger` keeps the max per id and reports whether the total changed; the tracker puts the total on every session and emits once per session on change.
- Vitest, web: `milestoneIndex` at 0, at each threshold, one below each threshold and far above the top; `shortTokens` for the values in the design; `movingCarCount` for idle, busy without subagents, busy with 3 and with 8.
- Browser with agent-browser: `HOME` pointed at a scratch folder with a copy of `server/tests/fixtures/session.json` holding a live pid and a transcript with one assistant line of 5B tokens. The lot shows every extra, the tooltip reads `5B tokens`, the turbine turns and the blimp bobs, measured with `getBoundingClientRect` samples over time. Then the same with 30M: bikes and 1 car only. Then an empty transcript: bay lines and nothing else, and no cars on the roads while idle.

## Risks / Trade-offs

- [A disk with gigabytes of transcripts takes tens of seconds to scan] → the park shows up at once with empty yards and fills once, when the scan is done.
- [Cache reads are 98 percent of the total, so the ladder climbs fast] → the ladder is tuned for that scale, and the README says what is counted.
- [The id map grows with every message ever written, about 100 bytes each] → 1M messages is about 100 MB, accepted for a local tool.
- [Claude Code renames a usage field] → the total stays 0 and yards stay empty; no crash, and the fixture tests point at the reader.
- [A threshold crossed during a busy session rebuilds the structure] → same in place rebuild as a model switch, at most 10 times ever per machine.
- [The forklift unloads into an empty bay below 500M] → reads as a staging area by the yellow lines; accepted.
- [Every assistant message on the machine emits every session of that machine] → same order of magnitude as today's model events, and the payload is small.
- [Two machines with the same name on a hub] → the hub already replaces the older socket; the total follows the session.

## Migration Plan

Everyone pulls the same commit. A hub on this version refuses a spoke on the old version through the protocol check, and the other way round. Rollback is the previous commit: the yards go back to 3 cars and a truck.
