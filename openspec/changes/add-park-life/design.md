## Context

See proposal.md for why, and `specs/factory-scene/spec.md` for behavior. This builds on the archived `restyle-industrial-park` change: lots are 60 unit grid cells with a 40 × 40 fenced yard, roads are 10 wide on cell edges, `StaticBuilder` bakes plain colors into vertex colors, and the scene is measured at 427 draw calls per frame with 4 lots and 4 warehouses (budget 800).

Today `Park` draws the bounding box of used cells plus one ring, and fills every cell without a lot with 40 trees. A busy lot's `RoadTruck` drives a square loop in the inner lane of its four surrounding roads (half size 27.5).

## Goals / Non-Goals

**Goals:**
- A compact park with no filler blocks.
- More life that still means something: the roads always have some traffic, while trucks, extra cars, and workers only appear for busy agents.
- Keep the draw call budget.

**Non-Goals:**
- Traffic lights, or cars waiting for cross traffic at crossings. Vehicles only keep distance to the vehicle ahead in their lane.
- Walking animations with moving limbs. Workers bob as they walk.
- Pedestrians outside yards.

## Decisions

### Compact park: draw per used cell, dedupe shared edges
`Park.rebuild` loops over used cells only. For each cell it adds its 4 road edges, 4 corner patches, sidewalks, curbs, lamps, and strip trees. Road edges and corners are keyed by grid position (`v:col:row`, `h:col:row`, `x:col:row`), so a road shared by two lots is drawn once and stays while either lot exists. Each road edge is 60 long; the dash texture repeats every 7.5 units so dashes line up across edges. Forest filler is removed.

`parkBounds` returns the tight bounds of used cells (no ring). `Park.extent()` adds a margin of half a cell for the camera and shadow area.
- Alternative: keep the ring but without trees. Rejected: still shows empty road blocks the user asked to remove.

### Park-wide traffic
A first version drove each lot's truck and cars on a fixed clockwise loop around their own lot. That looked like every car went the same way and only busy lots had traffic, so traffic is now one system for the whole park.

- Road graph (pure, `web/traffic-logic.ts`): crossings sit on cell corners. Every used cell adds both lanes of its 4 roads; lanes are keyed `col:row>col:row`, so a shared road is added once and keys stay stable when lots come and go.
- Lanes: the lane center is 2.5 from the road center, on the right of the direction of travel (right of heading `(dx, dz)` is `(-dz, dx)`). The straight part of a lane stops 5 before each crossing; a quadratic curve through the crossing joins it to the next lane. For a turn, the curve's control point is where the two lane lines cross.
- Routing: at the end of a lane a vehicle picks a random lane out of the crossing, never straight back. Every crossing of a used cell has at least 2 roads, so a U-turn is never needed.
- Spacing: each vehicle measures the bumper to bumper gap to the nearest vehicle in its lane or in the lane it turns into. It drives full speed from a gap of 8 and stops at 2. Cars drive 8 to 11 units/s, trucks 7, so faster cars catch up and follow. Cross traffic at crossings is not checked (see Non-Goals).
- Spawning: a new vehicle appears on one of its lot's own clockwise lanes (the lanes next to the lot), at a spot with room around it, and grows in over 0.5 s. When the lot no longer wants it, it keeps driving while it shrinks away. Vehicles on roads that are removed disappear at once, together with the road.
- Target count comes from `movingCarCount(lotBusy, busySubagents) = min(6, 2 + (lotBusy ? busySubagents : 0))` in `park-layout.ts`, plus 1 truck while the lot is busy. Idle lots also send 2 cars, so the roads are never empty while there is a lot; an empty road looked broken. `Lot.traffic()` reports it and `main.ts` passes every lot's request to `ParkTraffic`.
- Rendering: `ParkTraffic` in `traffic.ts` owns 3 `InstancedMesh`es for the whole park (car bodies with a per-instance color, car glass/tires/trim, and trucks), 120 instances each. That is 3 draw calls in total instead of 3 per lot.
- Car model faces +x, about 3.8 long: lower body, cabin, glass band, 4 wheels. The truck is about 12 long.

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
- `web/traffic-logic.ts`: pure road graph, lane poses, routing, spacing, and spawning.
- `web/traffic.ts`: car model geometries, `ParkedCars` (adds to a `StaticBuilder`), `ParkTraffic` (all moving trucks and cars in the park). Replaces `RoadTruck` usage in `lot.ts`; the truck model stays in `machines.ts`.
- `web/worker-logic.ts`: pure `stepWorker`.
- `web/workers.ts`: worker model and `LotWorkers` instanced mesh.
- `web/lot.ts`: wires parked cars and workers, passes warehouse busy states, and reports its traffic request.
- `web/main.ts`: owns `ParkTraffic`, updates its roads with the park, and ticks it with every lot's request.

### Testing
- Vitest: `parkBounds` tight bounds, `movingCarCount` (2 when idle, 2, 5 for 3 busy subagents, capped at 6), `stepWorker` (stays hidden while idle, walks out when busy, stays on its route segment while working, pauses at ends, walks back to the door and hides when idle, turns around when busy again on the way in), traffic logic (lane counts with shared roads, right lane per direction, lot lanes next to the lot, heading follows travel, smooth movement across turns, no U-turns, varied routes, stopping behind a vehicle, seeing a vehicle in the next lane, spawning on the lot's lanes and not on top of another vehicle).
- Browser checks with agent-browser against real sessions and headless test sessions: no filler blocks, shared road stays when a neighbour is removed, car count follows busy subagents, workers appear and go back inside, tooltip without folder, and a draw call recount.

## Risks / Trade-offs

- [A single lot now looks small on a big grass plane] → the camera fit uses the tight park extent, so the lot fills the view.
- [Vehicles can briefly overlap at crossings, when two of them turn into the same lane at once or cross paths] → accepted at this scale; once in the same lane the one behind stops until there is a gap.
- [Traffic drives past idle lots, and idle lots send cars too, so cars alone no longer show who is busy] → intended; trucks, extra cars per busy subagent, and the lot's own machines and workers still show activity.
- [Workers can clip a warehouse roller door or a moving forklift] → routes avoid static objects; brief overlap with moving machines is accepted at this scale.
- [Removing the ring changes the park extent, so the first camera fit zooms closer] → intended; the zoom limits still apply.
