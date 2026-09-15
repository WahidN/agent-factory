## Why

Every session gets the same factory, so the park does not show which model is doing the work. A Haiku session and a Fable session look identical. Sizing the factory by model makes the park read at a glance: small models get a small plant, big models get a big one.

## What Changes

- The server reads the model id from each transcript and sends it with every session and subagent. The session file has no model field, so the id comes from the `message.model` of the latest assistant line. The `<synthetic>` placeholder is ignored. Subagent meta files carry a short alias (`sonnet`, `opus`) that seeds the value until the subagent transcript has its first assistant line.
- The page maps the model id to one of 4 size tiers: `haiku` is small, `sonnet` is medium, `opus` is large, `fable` and `mythos` are huge. Anything else, including an unknown model, is medium, which is the look the park has today.
- A lot's hall and machines are built to its tier. The yard, fence, gate, dock door, hall door, parked cars, warehouse slots and worker routes stay where they are, so nothing else in the park moves. Small lots get a smaller hall with 1 stack, a small cooling tower and a searchlight on a short tower. Large and huge lots get a taller hall with more window rows, more and taller stacks, a bigger cooling tower and a taller searchlight tower.
- When a session switches model with `/model`, its lot is rebuilt in place to the new tier. Warehouses, workers and traffic keep going.
- The tooltip shows the model id for halls and warehouses. The line is left out when the model is not known yet.
- Warehouses keep one size. Sizing them by model is a possible follow-up.
- README gets a tier table, and its privacy note lists the model id as the third thing that leaves the server.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `agent-tracking`: new requirement to report the model id of each session and subagent, taken from the transcript, empty when unknown.
- `factory-scene`: "One factory per session" now sizes the hall and machines by model tier and rebuilds the lot when the tier changes; "Hover details" adds the model id line.

## Impact

- Server: `server/claude-reader.ts` (model event from assistant lines, `model` in subagent meta), `server/session-tracker.ts` (keeps the latest model per session and subagent), `server/types.ts` (`model` on `AgentState`). New fixture lines with a `model` field and tests for both.
- Web: new pure `web/model-tier.ts` (`tierFor`) with tests, `web/lot.ts` (per tier hall and machine table, rebuild on tier change), `web/tooltip.ts` and `web/style.css` (model line), `README.md`.
- Wire format: `AgentState` gains a `model: string` field. Old pages without the field still work, they show medium for every lot.
- Draw calls: a huge lot has more stacks but they are still one merged mesh per material, so the per lot draw call count does not change.
- Two choices are made in design.md and easy to flip: 4 tiers rather than 3 (Opus and Fable stay apart), and unknown models look medium.
