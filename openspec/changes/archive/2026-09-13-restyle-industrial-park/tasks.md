## 1. Pure layout helpers

- [x] 1.1 Create `web/park-layout.ts` with accent index for a `cwd`, park bounds from used cell indexes, road loop point and heading for a distance, and forklift position for a phase; verify Vitest tests pass for stable accents, bounds covering every used cell plus one ring, a continuous loop at corners that wraps after one lap, and forklift positions staying within the path
- [x] 1.2 Change `PLOT_SIZE` in `web/plots.ts` to 60; verify the existing plots tests still pass

## 2. Palette, textures, and merging

- [x] 2.1 Create `web/palette.ts` with the design palette, the 8 accent colors, shared materials, and canvas textures for the window bay (color map plus glass-only emissive map), road center dashes, and yellow hatch; verify `npx tsc --noEmit` passes and a temporary test page shows each texture drawn correctly in agent-browser
- [x] 2.2 Create `web/static-builder.ts` that collects meshes by material and merges them with `mergeGeometries`; verify a unit test that 10 boxes with 2 plain materials become 1 vertex-colored mesh with the combined vertex count, while separate, textured, and transparent materials keep their own meshes

## 3. Scene and park

- [x] 3.1 Rewrite `web/scene.ts` with an orthographic camera at azimuth 45° and elevation about 35°, `OrbitControls` rotate plus zoom limits and the polar angle limit, hemisphere light, sun with soft PCF shadows sized to the town bounds, neutral tone mapping, and an `EffectComposer` with `GTAOPass`; verify in agent-browser that parallel edges stay parallel, drag rotates, scroll zooms, and the camera cannot go below ground
- [x] 3.2 Create `web/park.ts` drawing grass, roads with dashed center lines and curbs, instanced pine trees, and street lamps for the used bounds plus one ring, rebuilding only when bounds change; verify in agent-browser that roads reach every lot and trees do not move when a lot is added

## 4. Machines (web/machines.ts)

- [x] 4.1 Build `Smoke` pool and `Stacks` (steel frame, 3 stacks, orange rims with emissive glow, smoke rate and size by activity); verify in agent-browser with a headless session running `ping -c 40 127.0.0.1` that rims glow and smoke gets thick
- [x] 4.2 Build `Forklift` (body, mast, forks, pallet) moving between dock and truck and raising forks at each end, stopping in place when inactive; verify in agent-browser that an Edit call moves the forklift and it stays where it stopped
- [x] 4.3 Build `Searchlight` (lattice tower, head, additive beam cone, ground light pool) sweeping by activity; verify in agent-browser that a Read call turns the beam on and it sweeps
- [x] 4.4 Build `CoolingTower` (lathe hyperboloid with red band) with steam from the top by activity; verify in agent-browser that a ToolSearch call makes it steam
- [x] 4.5 Build `Truck` (cab plus trailer) used both parked and on the road loop; verify in agent-browser that a busy session's truck drives the roads around its lot and turns at corners

## 5. Lot and warehouses

- [x] 5.1 Create `web/lot.ts`: fenced yard with gate, hall with window bay walls, parapet roof, base stripe and dock door in the folder accent, rooftop vents, skylights and AC boxes, pallets, markings, and the name sign; static parts merged with the static builder; verify in agent-browser that every session shows a lot, same-folder sessions share an accent, and the lot matches the reference style
- [x] 5.2 Wire lot animations to state: window glow and road truck for busy, tool mapping to stacks, forklift, searchlight, cooling tower, idle fade of accent and windows; verify in agent-browser with real tool calls that each tool drives only its machine
- [x] 5.3 Create `web/warehouse.ts` with lit windows, small stack, roller door with sliding pallet, rooftop lamp, and rooftop fan, plus grow and shrink; move the slot logic (max 4, overflow count on the sign) into `Lot`; verify in agent-browser with 5 subagents that 4 warehouses and a "+1" count appear and they shrink away after 60 seconds quiet
- [x] 5.4 Add the sink animation for removed lots and free the cell afterwards; verify in agent-browser by stopping a headless session

## 6. Wiring and cleanup

- [x] 6.1 Update `web/main.ts` to create `Lot`s, pass used cells to `Park`, and refocus the camera and shadow bounds; change `web/tooltip.ts` to a `{ state, gone }` interface; verify in agent-browser that hovering a hall and a warehouse shows the right tooltip and it hides off target
- [x] 6.2 Delete `web/factory.ts` and `web/subagent.ts` and any code only they used; verify `npx tsc --noEmit` passes and `grep` finds no references to them

## 7. End-to-end check

- [x] 7.1 Measure WebGL draw calls per frame in agent-browser by counting `drawElements` and `drawArrays` over one second with 4 lots and 4 warehouses; verify it is under 800, otherwise merge or instance more before continuing
- [x] 7.2 With real sessions running, use agent-browser to confirm: lots on roads, idle lots still, the active lot animates with the right machine, reconnect still works, and a page reload restores everything; take a screenshot next to the reference image as proof
- [x] 7.3 Run `npm test`, `npx tsc --noEmit`, and `openspec validate restyle-industrial-park --strict`; verify all pass
