## 1. Server: model from the transcript

- [x] 1.1 In `server/claude-reader.ts`, rename `ToolEvent` to `TranscriptEvent`, add a `model` event for assistant lines with a non-empty `message.model` other than `<synthetic>`, and return `model` from `parseSubagentMeta`; add `model` to the assistant lines in the fixtures; verify Vitest tests pass for model events, the skipped `<synthetic>` line, and the meta alias
- [x] 1.2 Add `model: string` to `AgentState` in `server/types.ts`; in `server/session-tracker.ts` keep the latest model per session and subagent, seed a subagent from its meta alias, and pass the alias through from `server/index.ts`; verify Vitest tests pass for the latest model, a switch that emits an update, an empty model before any assistant line, and the alias until the transcript names a model

## 2. Web: tiers

- [x] 2.1 Create `web/model-tier.ts` with `ModelTier` and `tierFor`; verify Vitest tests pass for `haiku`, `sonnet`, `opus`, `fable`, `mythos`, the aliases `sonnet` and `opus`, a dated Haiku id, an empty string, `<synthetic>`, and an unknown id
- [x] 2.2 In `web/lot.ts`, replace the fixed hall and machine constants with the per tier table from design.md, drop rooftop details outside the footprint, and hang the sign 4 above the tier's roof; verify in agent-browser with 4 headless test sessions, one per model, that the 4 lots show the 4 sizes side by side and that no stack frame or cooling tower touches a parked car, a worker route, or the fence
- [x] 2.3 Move the hall, machines, parked truck and sign into a `structure` group and rebuild it when `tierFor(state.model)` changes; verify in agent-browser that switching a test session's model from `sonnet` to `opus` grows the hall in place without a sink, that its warehouses stay where they are, and that the tooltip still works on the new hall
- [x] 2.4 Check the huge lot from the default camera; verify that its warehouses and yard are not hidden behind the 3 row hall, or cap huge at 2 rows plus rooftop bulk and update the spec table

## 3. Tooltip and docs

- [x] 3.1 Add the `model` line to `web/tooltip.ts` and its style to `web/style.css`, skipped while the model is empty; verify in agent-browser that a hall and a warehouse show the model id and that a session without a model shows no model line
- [x] 3.2 Add the tier table to `README.md` and add the model id to the privacy note

## 4. End-to-end check

- [x] 4.1 Recount WebGL draw calls per frame in agent-browser with 4 lots (one per tier) and 4 warehouses while busy; verify it stays under 800
- [x] 4.2 Run `pnpm test`, `pnpm typecheck`, and `openspec validate size-lots-by-model --strict`; verify all pass, and take a screenshot with the 4 tiers
