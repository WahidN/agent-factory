## Context

See proposal.md for why, and `specs/factory-scene/spec.md` for behavior. This builds on the archived `restyle-industrial-park` change: lots are 60 unit grid cells with a 40 × 40 fenced yard, roads are 10 wide on cell edges, `StaticBuilder` bakes plain colors into vertex colors, and the scene is measured at 427 draw calls per frame with 4 lots and 4 warehouses (budget 800).

Today `Park` draws the bounding box of used cells plus one ring, and fills every cell without a lot with 40 trees. A busy lot's `RoadTruck` drives a square loop in the inner lane of its four surrounding roads (half size 27.5).

## Goals / Non-Goals

**Goals:**
- A compact park with no filler blocks.
- More life that still means something: moving cars and workers only appear for busy agents.
- Keep the draw call budget.

**Non-Goals:**
- Traffic rules, intersections that cars wait at, or collision avoidance between lots.
- Walking animations with moving limbs. Workers bob as they walk.
- Pedestrians outside yards.

## Decisions

### Compact park: draw per used cell, dedupe shared edges
`Park.rebuild` loops over used cells only. For each cell it adds its 4 road edges, 4 corner patches, sidewalks, curbs, lamps, and strip trees. Road edges and corners are keyed by grid position (`v:col:row`, `h:col:row`, `x:col:row`), so a road shared by two lots is drawn once and stays while either lot exists. Each road edge is 60 long; the dash texture repeats every 7.5 units so dashes line up across edges. Forest filler is removed.

`parkBounds` returns the tight bounds of used cells (no ring). `Park.extent()` adds a margin of half a cell for the camera and shadow area.
- Alternative: keep the ring but without trees. Rejected: still shows empty road blocks the user asked to remove.

### Cars on the lot loop
- Moving cars share the truck's loop (inner lane, half size 27.5). Adjacent lots' loops use opposite lanes of a shared road and drive in opposite directions, so lots never overlap each other.
- The loop has 7 evenly spaced positions (truck plus up to 6 cars), so vehicles on one loop never overlap. Loop perimeter is 220, so they are about 31 units apart.
- Target count comes from a pure function `movingCarCount(lotBusy, busySubagents) = lotBusy ? min(6, 2 + busySubagents) : 0` in `park-layout.ts`. Each car slot has a presence value easing toward 0 or 1 over 0.5 s and scales with it.
- Rendering: one `InstancedMesh` for car bodies with a per-instance color from a small car palette, and one for glass, tires, and trim. That is 2 draw calls per lot for all its moving cars.
- Car model faces +x, about 3.8 long: lower body, cabin, glass band, 4 wheels.

### Parked cars
3 cars parked side by side in the open yard area between the parked truck and the cooling tower (around x 1, 3.6, 6.2 at z 6, nose toward the hall), with white parking lines. They are added to the lot's `StaticBuilder`, so they add no draw calls. Colors are picked from the car palette by a hash of the session id, so they stay the same across reloads.

### Workers: pure walking logic plus one instanced mesh per lot
`web/worker-logic.ts` holds a pure step function, easy to test with a fake clock:

```ts
type WorkerMode = "inside" | "out" | "working" | "in";
type Worker = { x: number; z: number; heading: number; mode: WorkerMode; target: 0 | 1; pause: number; walked: number };
function stepWorker(worker: Worker, dt: number, busy: boolean, door: Point, route: [Point, Point]): Worker;
```

- `inside` → when busy, start at the door and switch to `out`.
- `out` → walk to `route[0]`, then `working`.
- `working` → walk back and forth between the two route points, pausing 1.2 s at each end. When not busy, switch to `in`.
- `in` → walk to the door, then `inside`. If busy again on the way, switch to `out`.
- Walking speed 1.4 units per second. `walked` accumulates distance for the walking bob.

Routes are fixed straight segments chosen to avoid buildings and machines:

| Worker | Door | Route |
|---|---|---|
| 1 | hall door (1.5, −3.3) | (1.5, −3.3) ↔ (3, 8.5), past the hatch to the parking |
| 2 | hall door | (−2.5, −3.3) ↔ (−2.5, 3.5), beside the forklift lane |
| 3 | hall door | (7, −6.5) ↔ (17.5, −6), between stacks frame and cooling tower |
| 4 | hall door | (5, 9.5) ↔ (18.5, 9.5), along the walkway to the gate |
| warehouse slot | its door (slot x + 1.2, 16.9) | (slot x − 1.8, 17.6) ↔ (slot x + 1.8, 17.6) |

Main yard workers use the lot's busy state; each warehouse worker uses its subagent's busy state and exists while the warehouse exists.

`web/workers.ts` renders all workers of one lot as one `InstancedMesh` (8 instances: 4 yard plus 4 warehouse slots). The worker model is one baked geometry about 1.9 tall: dark legs, orange safety vest, skin-colored head, yellow hard hat. Hidden workers get a zero scale matrix. The mesh sits inside the lot body, so workers sink with the lot.
- Alternative: one mesh per worker. Rejected: up to 32 extra draw calls per frame per lot across passes.

### Camera fit after the first snapshot
Found during the build: the zoom used to be fitted on the very first `refocus`, which runs before any lot exists. With the ring of cells gone, that first extent is a single cell, so the view zoomed in too far and later lots were off screen. The zoom is now fitted once, after all lots from the first snapshot are created, using both screen height and width (a square town seen isometrically is about 1.9 half extents tall and 3 wide). Reconnect snapshots keep the user's zoom.

### Tooltip
Remove the folder line from `tooltip.ts` and its `.cwd` style. The server still sends `cwd`, because lots use it for the accent color.

### Module layout
- `web/park-layout.ts`: tight `parkBounds`, new `movingCarCount`.
- `web/park.ts`: per-used-cell drawing with deduped edges.
- `web/traffic.ts`: car model geometries, `ParkedCars` (adds to a `StaticBuilder`), `LotTraffic` (truck plus moving cars on the loop). Replaces `RoadTruck` usage in `lot.ts`; the truck model stays in `machines.ts`.
- `web/worker-logic.ts`: pure `stepWorker`.
- `web/workers.ts`: worker model and `LotWorkers` instanced mesh.
- `web/lot.ts`: wires parked cars, traffic, and workers, and passes busy subagent count and warehouse busy states.

### Testing
- Vitest: `parkBounds` tight bounds, `movingCarCount` (0 when idle, 2, 5 for 3 busy subagents, capped at 6), `stepWorker` (stays hidden while idle, walks out when busy, stays on its route segment while working, pauses at ends, walks back to the door and hides when idle, turns around when busy again on the way in).
- Browser checks with agent-browser against real sessions and headless test sessions: no filler blocks, shared road stays when a neighbour is removed, car count follows busy subagents, workers appear and go back inside, tooltip without folder, and a draw call recount.

## Risks / Trade-offs

- [A single lot now looks small on a big grass plane] → the camera fit uses the tight park extent, so the lot fills the view.
- [Cars from a lot's loop cross the corner patches of neighbours' roads] → loops of different lots use different lanes, so they only visually cross at intersections, never overlap in a lane.
- [Workers can clip a warehouse roller door or a moving forklift] → routes avoid static objects; brief overlap with moving machines is accepted at this scale.
- [Removing the ring changes the park extent, so the first camera fit zooms closer] → intended; the zoom limits still apply.
