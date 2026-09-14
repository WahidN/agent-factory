## Context

See proposal.md for why. Specs are in `specs/agent-tracking/spec.md` and `specs/factory-scene/spec.md`.

Today every lot is built from one set of constants in `web/lot.ts`: the hall spans x -18 to 4 and z -18 to -4 with a wall of one bay (6 high, `WALL_BAY`), 3 stacks at (12, -12), the cooling tower at (12.5, 0.5) with radius 3.6, and the searchlight tower at (-17, 12). The dock door sits at x -7 and the hall door at (1.5, -3.3). Worker routes, warehouse slots and parked cars from the `add-park-life` design are placed around these anchors. All static parts go through `StaticBuilder`, so a lot is a few merged meshes.

The server knows nothing about models. The session file in `~/.claude/sessions/` has no model field. Every assistant line in a transcript has `message.model` (for example `claude-fable-5-1`, `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5-20251001`), and some lines carry the placeholder `<synthetic>`. A subagent's `.meta.json` may have a short alias in `model` (`sonnet`, `opus`). On first sight the server reads only the last 64 KB of a transcript.

The `add-park-life` change is implemented but not archived. This change's "Hover details" delta builds on that change's version of the requirement (no folder line), so `add-park-life` must be archived first.

## Goals / Non-Goals

**Goals:**
- Four sizes that read at a glance from the default camera.
- Nothing outside the hall and its machines moves, so worker routes, warehouse slots, parked cars and traffic keep working unchanged.
- A tier change rebuilds the lot in place, with no sink and rise.
- Keep the draw call budget of 800 per frame.

**Non-Goals:**
- Warehouse sizes by model.
- Lots bigger than one grid cell.
- Showing the model on the sign, or coloring by model.

## Decisions

### Model comes from the transcript, as a raw id
The session file has no model, so `parseTranscriptChunk` emits a `model` event for every assistant line whose `message.model` is a non-empty string other than `<synthetic>`. The event union is renamed from `ToolEvent` to `TranscriptEvent` because it now carries more than tools. `SessionTracker` keeps the latest model per session and per subagent and puts it on `AgentState.model`. `parseSubagentMeta` returns the `model` alias, and the tracker uses it as the starting value until the subagent transcript names a model.

The server sends the raw id, not a tier. The tooltip shows the id, and the visual mapping is a page decision that can change without a server release.
- Alternative: the server maps to a tier. Rejected: loses the id for the tooltip and puts a visual choice in the server.
- Alternative: read the model from the session file. Not possible, the field does not exist.

The 64 KB tail is enough: the latest assistant line in it names the model in use now, which is the one we want.

### Tier by family name, four tiers
`web/model-tier.ts` is pure and tested:

```ts
export type ModelTier = "small" | "medium" | "large" | "huge";
export function tierFor(model: string): ModelTier;
```

It lowercases the id and checks for `haiku`, `sonnet`, `opus`, then `fable` or `mythos`. Anything else, including an empty string, is `medium`. Substring matching also covers the subagent aliases and dated ids like `claude-haiku-4-5-20251001`.
- Alternative: an exact id table. Rejected: breaks on every new dated id.
- Alternative: 3 tiers with Opus and Fable both large. Rejected for now: the user runs both, and the difference is the point. Folding them back is a one line change in `tierFor` and one row in the spec table.

### Lot geometry per tier, anchored on the dock side
The hall keeps its right and front edges (x1 = 4, z1 = -4). The small hall shrinks toward the back left corner, so the dock door at x -7 and the hall door at (1.5, -3.3) do not move and every worker route stays valid. Wall height is `bays * WALL_BAY.height`; the wall texture repeats vertically, so 2 or 3 bays give 2 or 3 rows of windows for free. Rooftop vents, skylights and AC boxes are dropped when they fall outside the footprint. The sign hangs 4 above the roof of the tier.

| Tier | Hall x0..x1, z0..z1 | Bays | Stacks (count, height, radius, anchor) | Cooling tower (radius, height, anchor) | Searchlight tower height, reach |
|---|---|---|---|---|---|
| small | -10..4, -12..-4 | 1 | 1, 7, 0.7, (12, -12), no frame | 2.4, 5, (12.5, 0.5) | 5, 9 |
| medium | -18..4, -18..-4 | 1 | 3, 11, 0.9, (12, -12), frame | 3.6, 8, (12.5, 0.5) | 9, 11 |
| large | -18..4, -18..-4 | 2 | 4, 14, 0.95, (12, -12), frame | 4.2, 11, (12.5, 0.5) | 12, 12 |
| huge | -18..4, -18..-4 | 3 | 5, 17, 0.85, (12, -13), frame | 4.8, 14, (13.5, 1) | 14, 13 |

Fit checks behind the numbers: `Stacks` spaces stacks `radius * 2.5` apart and the frame half size is `spacing * count / 2 + radius / 2`. Worker route 3 runs at about z -6 between the stacks and the cooling tower, so the frame's front edge must stay behind z -6.8. Large gives a frame from z -17.2 to -6.8. Huge with 5 stacks needs half 5.7, so its anchor moves back to z -13, giving z -18.7 to -7.3, still inside the fence at -20. The huge cooling tower with radius 4.8 moves to (13.5, 1) so it keeps 1.6 clearance from the parked cars, 1.5 from the fence and 1.0 from worker route 3. All tiers keep the same four machines, so every tool animation works on every tier.
- Alternative: bigger lots that take more grid cells. Rejected: touches plots, roads, the road graph and traffic for a small gain in readability.
- Alternative: make today's lot the small tier and grow from there. Rejected: a 4 bay hall on this footprint looks like a tower, and most sessions run Sonnet or Opus, so the park would get very tall.

### Rebuild in place on tier change
`Lot` keeps `tier`. The static hall, yard markings, machines, parked cars and sign live in one `structure` group inside `body`; warehouses, the workers mesh and the parked truck are added to `body` directly. The truck is the same on every tier and shares the truck template's geometry, so keeping it out of the rebuilt group also keeps its geometry safe from disposal. When `update()` sees a different `tierFor(state.model)`, it removes and disposes `structure` (merged geometries, machine smoke meshes, glowing materials, the sign element) and builds a new one with the same wall and accent materials. `body.position.y` drives the appear and exit animation, so a rebuild during the rise just rises as the new tier. The hall pickables list is replaced; the tooltip asks each lot for pickables every frame, so it never holds a stale mesh.

This matters for every new session: the session file appears first, so the lot rises as medium, and the first assistant line arrives a moment later.
- Alternative: `main.ts` removes the lot and creates a new one. Rejected: a 2 second sink and rise on almost every new session.

### Tooltip
`tooltip.ts` adds a `model` line after the tool line, in a muted color, and skips it when the model is empty. The render key includes the model so a switch redraws.

### Module layout
- `server/claude-reader.ts`: `model` event, `model` in `SubagentMeta`
- `server/session-tracker.ts`: latest model per session and subagent
- `server/types.ts`: `AgentState.model`
- `web/model-tier.ts`: `tierFor`
- `web/lot.ts`: tier table, `buildStructure(tier)`, rebuild on change
- `web/tooltip.ts`, `web/style.css`: model line
- `README.md`: tier table, privacy note

### Testing
- Vitest, server: `parseTranscriptChunk` emits model events and skips `<synthetic>`; `parseSubagentMeta` returns the alias; the tracker keeps the latest model, starts a subagent from its alias, and emits on a switch. Fixtures get `model` on their assistant lines to match real transcripts.
- Vitest, web: `tierFor` for each family, the aliases, a dated Haiku id, an empty string, `<synthetic>`, and an unknown id.
- Browser with agent-browser and headless test sessions: one lot per tier side by side, measured hall heights, a tier switch without a sink, warehouses staying put, tooltip model line, and a draw call recount with 4 lots.

## Risks / Trade-offs

- [A 3 row hall may hide part of the yard from some camera angles] → check the default view during apply; if warehouses are hidden, cap huge at 2 rows and add rooftop bulk (water tank, taller vents) instead.
- [Model ids change with releases] → family substring match, unknown ids fall back to medium.
- [A fresh session has no assistant line in its tail yet] → model stays empty and the lot is medium until the first response, then rebuilds in place.
- [Alias and id differ for the same subagent, `sonnet` then `claude-sonnet-5`] → same tier, the tooltip text changes once.
- [Rebuild allocates new merged geometry] → only on a tier change, which is rare.
- [Wire format grows] → additive field, old pages ignore it and show medium.
