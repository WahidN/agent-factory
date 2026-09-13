## 1. Pure logic

- [x] 1.1 Make `parkBounds` return tight bounds of used cells and add `movingCarCount(lotBusy, busySubagents)` in `web/park-layout.ts`; verify updated Vitest tests pass for tight bounds and car counts 0, 2, 5, and a cap of 6
- [x] 1.2 Create `web/worker-logic.ts` with `stepWorker`; verify Vitest tests pass for staying hidden while idle, walking out when busy, staying on the route while working, pausing at route ends, returning to the door and hiding when idle, and turning around when busy again on the way in

## 2. Compact park

- [x] 2.1 Rewrite `Park.rebuild` to draw roads, corner patches, sidewalks, curbs, lamps, and strip trees only around used cells, with shared edges drawn once, dash repeat 7.5, no forest filler, and `extent()` with a half cell margin; verify in agent-browser that no filler blocks are shown and road dashes line up across edges
- [x] 2.2 Verify in agent-browser with a headless test session next to an existing lot that roads extend to the new lot, and that after it ends the shared road stays and its other roads disappear

## 3. Traffic

- [x] 3.1 Create `web/traffic.ts` with the car model (body geometry plus glass, tires, and trim geometry) and `ParkedCars` adding 3 cars and parking lines to a `StaticBuilder`, colors stable per session id; verify in agent-browser that every yard, busy or idle, shows 3 parked cars
- [x] 3.2 Add `LotTraffic`: truck plus up to 6 cars on 7 evenly spaced loop positions, 2 instanced meshes with per-instance body colors, presence easing per car slot; replace `RoadTruck` use in `web/lot.ts`; verify in agent-browser that a busy lot shows 2 cars and a truck, and that cars shrink away when it goes idle
- [x] 3.3 Verify in agent-browser that busy subagents add cars: with 3 busy subagents the lot shows 5 moving cars

## 4. Workers

- [x] 4.1 Create `web/workers.ts` with the baked worker model and `LotWorkers` (one `InstancedMesh`, 4 yard routes and 4 warehouse slot routes from the design table, walking bob); wire into `web/lot.ts` with the lot busy state and each warehouse's busy state; verify in agent-browser that workers come out of the hall door when the session is busy and walk their routes without crossing buildings
- [x] 4.2 Verify in agent-browser that a busy subagent warehouse gets a worker in front of it, and that workers walk back to the door and disappear when the session goes idle

## 5. Tooltip

- [x] 5.1 Remove the folder line from `web/tooltip.ts` and the `.cwd` rule from `web/style.css`; verify in agent-browser that hovering a hall and a warehouse shows name, status, and tool but no path

## 6. End-to-end check

- [x] 6.1 Recount WebGL draw calls per frame in agent-browser with 4 lots and 4 warehouses while busy (cars and workers visible); verify it stays under 800
- [x] 6.2 Run `npm test`, `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`, and `openspec validate add-park-life --strict`; verify all pass, and take a final screenshot
