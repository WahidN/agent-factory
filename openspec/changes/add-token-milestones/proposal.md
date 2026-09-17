## Why

Every yard looks the same today: 3 parked cars, a parked truck, and 2 cars driving the roads whether the agent works or not. That decoration says nothing. The tokens a user has burned in Claude Code are a number people already know and compare, and the transcripts on disk hold that number. Turning it into things in the yard makes the park personal: a heavy user's lots fill up with a helicopter and a blimp, a new user's lot starts empty and earns its first car. Counted from the beginning of time, a heavy user would get the whole ladder on day one and a colleague joining later could never catch up, so the count starts on a fixed date and every machine earns from the same starting line.

## What Changes

- The yard starts empty. No parked cars, no parked truck. The white bay lines and the truck bay lines stay, so it reads as an empty parking lot. Every sign stays as it is.
- The roads go quiet too. An idle lot sends nothing onto the roads. A busy lot sends its truck plus 1 car per busy subagent, so traffic only shows activity.
- The server counts the machine's Claude Code tokens since the season start, 16 September 2026 00:00 UTC, the same way PokeTokenBar counts them: every assistant message written at or after that moment in every transcript under `~/.claude/projects/`, input plus output plus cache write plus cache read, each message counted once even when the transcript logs it several times. Older messages add nothing, so every machine starts at 0 on the same day. Subagent transcripts and finished sessions count too. On start it scans every transcript once in the background, then adds new lines as it already tails them. A new season is one date change in the code.
- The total travels with every session state as `machineTokens`. A hub relays it untouched, so on a shared park each machine's lots show that user's own total. The relay protocol number goes to 2.
- Each lot shows extras for the total of its machine. The ladder is cumulative and goes up to 5B:

| Tokens | Extra in the yard |
|---|---|
| 10M | bike rack with 3 bikes at the people door |
| 25M | 1st parked car |
| 50M | 2nd parked car |
| 100M | 3rd parked car, and a flagpole with a flag in the accent colour by the gate |
| 250M | coffee cart and a picnic table along the walkway |
| 500M | the truck at the dock bay |
| 750M | 2 EV chargers and a sports car in the front left corner |
| 1B | helipad with a helicopter on the hall roof |
| 2.5B | wind turbine at the front left fence, blades turning |
| 5B | blimp in the accent colour tethered above the hall, bobbing |

- When the total crosses a threshold the lot is rebuilt in place, the way a model switch rebuilds it today. Until the first scan finishes the total is 0 and the yard is empty; the extras appear when the scan is done.
- The hall tooltip gets one line with the short total, for example `4.4B tokens`, so you can see why a lot has what it has.
- The forklift keeps its route. It now carries pallets between the dock and the truck bay, which is empty until 500M.
- README: the state table loses the always-driving cars, and a new section lists the ladder, the counting rule with the season start, and that the total is one number per machine that a hub shares with everyone on it.
- **BREAKING (wire):** `SessionState` gains `machineTokens`. A hub on the old version refuses a spoke on this version through the protocol check.

Not in this change: a per session total, a season start that differs per machine or is stored on disk, tokens from `~/.config/claude` or `CLAUDE_CONFIG_DIR`, a cost in dollars, a token counter on the yard sign, and any file written under `~/.claude/`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-tracking`: new requirement "Report season token usage" for the scan, the counting rule with the season start and the field on every session; "Large transcripts stay cheap" allows the one time background scan of whole transcripts without delaying the session list.
- `factory-scene`: new requirement "Token milestones" with the ladder and the in place rebuild; "One factory per session" drops the parked cars from what every tier shares; "Animate by status and tool" and "Traffic follows activity" make an idle lot send no vehicles and a busy lot send only its truck and subagent cars, with no parked cars by default; "Hover details" adds the token line.

## Impact

- Server: `server/claude-reader.ts` (usage per assistant line, dedup key), new `server/usage-ledger.ts` (pure keep-max ledger with a total that ignores messages from before the season start), `server/session-tracker.ts` (`machineTokens` on every session state), `server/index.ts` (background scan of `~/.claude/projects/`, usage from tailed lines, a full read of a transcript first seen from the middle), `server/hub.ts` (protocol 2), `server/types.ts`. Tests for the parser, the ledger and the tracker field, with a fixture holding duplicate and resumed lines, and ledger cases for messages before and at the season start.
- Web: new `web/milestones.ts` (ladder, threshold lookup, builders for the extras, tick for the turbine and blimp), `web/lot.ts` (no default vehicles, rebuild key includes the milestone, tick the animated extras), `web/traffic.ts` (parked cars take a count, truck parts reusable for a static bake), `web/machines.ts` (truck parts shared), `web/park-layout.ts` (`movingCarCount` without the baseline 2), `web/tooltip.ts` and `web/sign-text.ts` (short token format). Tests for the ladder lookup, the short format and the car count.
- Docs: `README.md`.
- Wire format: `SessionState.machineTokens: number`. Protocol `2`.
- The unarchived change `add-network-hub` is merged. This change's `factory-scene` deltas for "One factory per session" and "Hover details" build on its version, so archive it first.
