## Why

The park still fills empty grid cells with forest blocks, so a few sessions sit in a big mostly-empty town. The town also feels lifeless apart from one truck per busy lot, and the tooltip shows full folder paths the user does not want on screen.

## What Changes

- Roads, sidewalks, trees, and lamps are only drawn around cells that have a lot. Unused cells stay plain grass. A road shared with a neighbour lot stays when one of the two lots goes away.
- Each busy lot sends cars around its roads next to its truck: 2 cars, plus 1 for each busy subagent, up to 6. Cars drive away when the lot goes idle.
- Every yard gets a few parked cars, also when idle.
- Small workers walk and work in busy lots: 4 in the main yard, and 1 in front of each busy subagent warehouse. When the lot goes idle, workers walk back inside and disappear.
- **BREAKING (visual):** the tooltip no longer shows the working folder.
- No server changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `factory-scene`: park drawn only around used cells, busy and idle animation now includes cars and workers, new traffic and worker requirements, tooltip without folder.

## Impact

- Web code only: `web/park.ts` and `web/park-layout.ts` (compact park, car count), new `web/traffic.ts` (moving and parked cars) and `web/workers.ts` plus pure walking logic in `web/worker-logic.ts`, `web/lot.ts` wiring, `web/tooltip.ts` and `web/style.css` (folder line removed).
- Cars and workers use instanced meshes per lot, and parked cars are merged into the lot's static mesh, so the draw call budget (under 800 per frame) still holds.
