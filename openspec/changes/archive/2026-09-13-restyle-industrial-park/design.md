## Context

See proposal.md for why, and `specs/factory-scene/spec.md` for the required behavior. The reference image is a pre-rendered low-poly industrial park (Unity asset store screenshot): grey flat-roof halls with an orange base stripe and window grids, rooftop vents and skylights, asphalt yards with yellow markings, forklifts, trucks, orange-top stacks on a steel frame, a hyperboloid cooling tower with a red band, pine trees, fences, and soft ambient occlusion.

Current web code (from the archived `add-agent-factory-visualizer` change): `scene.ts` (perspective camera, checkered ground), `factory.ts` (cartoon factory with arm, furnace, radar, gear), `subagent.ts` (workshops), `plots.ts` (grid index allocation), `activity.ts` (0..1 easing with minimum hold), `tooltip.ts`, `main.ts`. The server and its WebSocket messages do not change.

## Goals / Non-Goals

**Goals:**
- Get visibly close to the reference style using only code and Three.js primitives.
- Keep the existing state flow: `main.ts` receives `SessionState`, one scene object per session, `Activity` drives every animation.
- Stay smooth with around 10 lots on a laptop.

**Non-Goals:**
- A 1:1 copy of the reference render or its asset pack.
- Loading external 3D models or textures from files. Textures are drawn on canvases at startup.
- Cars, people, or traffic rules beyond one truck per busy lot.
- Day/night cycle or weather.

## Decisions

### Code-built models, no asset files
Every model is built from Three.js primitives (`BoxGeometry`, `CylinderGeometry`, `LatheGeometry`, `ConeGeometry`) with smooth shading and a small shared palette. Window grids and road markings are canvas textures made at startup.
- Alternative: free CC0 glTF model packs. Rejected by the user: style mismatch and less control over animated parts.
- Alternative: the actual Unity asset. Rejected: license for web use is unclear, and exporting from Unity is manual.

### Palette
| Use | Color |
|---|---|
| grass | `#5fae4a` |
| road asphalt | `#5d6064` |
| yard asphalt | `#7c7f83` |
| hall walls | `#a3a6aa` |
| roof | `#6f7276` |
| window frames / glass | `#e9edf0` / `#9fb7c6` |
| yellow markings, forklift | `#f2c230` |
| pine trees | `#2f7d4a`, `#3f9a57` |
| stack rims, default accent | `#e2702f` |
| cooling tower band | `#d23c35` |

Folder accent colors come from a fixed list of 8 industrial colors (orange, red, teal, blue, yellow, green, purple, brown), picked by a hash of `cwd`. A fixed list keeps every accent readable on grey, unlike the old random hue.

### Lot layout
The grid cell size becomes 60 units (`PLOT_SIZE` in `plots.ts`). The existing index allocation and spiral order stay, so their unit tests stay valid. Each cell has:
- A 10 unit road on each cell edge, shared with the neighbour cell, with dashed white center lines and light curbs.
- A 3 unit green strip between road and fence with pine trees and street lamps.
- A fenced 40 × 40 asphalt yard in the center (low concrete wall with posts), with the gate opening on the right side. It was 44 × 44 in the first draft; 40 leaves room for sidewalks and trees.

Inside the yard (x to the right, z toward the default camera):

| Item | Position | Notes |
|---|---|---|
| main hall | x −18..4, z −18..−4, 7 high | flat roof with parapet, base stripe, dock door at x −7 |
| rooftop | on hall | about 8 vents, 3 skylight strips, 2 AC boxes |
| pallets | around (−13, −1) | small stacks |
| forklift | path z −2.5 ↔ 3 at x −7 | carries a pallet between dock and truck |
| parked truck | x −15..−1, z 4.2..6.8 | cab plus trailer, parallel to the hall |
| stacks on steel frame | around (13, −13) | 3 stacks, 11 high, orange rims |
| cooling tower | around (14, −1) | lathe hyperboloid, radius about 3.5, red band |
| lattice tower + searchlight | around (−20, 9) | 9 high |
| subagent warehouses | 4 slots at z 15, x −15, −6, 3, 12 | 6 × 3.5 × 5 each |
| yellow hatch + dashed lines | near the dock and truck | canvas texture decals |

Positions are starting points and may be tuned visually during implementation.

### Park module owns shared ground
`web/park.ts` draws the grass plane, roads, curbs, trees, and lamps for the bounding box of used cells plus one ring of cells around it. It rebuilds only when that bounding box changes. Lots own only what is inside their fence. Tree positions use a seeded random per cell, so a rebuild never moves trees.
- Alternative: every lot draws its own surrounding roads. Rejected: neighbour lots would draw the same road twice.

### Isometric-style camera
`OrthographicCamera` looking from azimuth 45° and elevation about 35°, like classic isometric views. `OrbitControls` still rotates, and zoom changes `camera.zoom` (limited range). The polar angle limit stays so the view never goes below ground. Refocusing on the town center works as today.
- Alternative: perspective camera with a narrow field of view. Rejected: still has visible distortion and makes zoom limits awkward.

### Lighting and ambient occlusion
- `EffectComposer` with `RenderPass`, `GTAOPass`, and `OutputPass`. `GTAOPass` supports orthographic cameras, so no extra dependency is needed.
- One directional sun with `PCFShadowMap` and `shadow.radius` for softer edges. Its shadow camera is resized to cover the used cells when the town bounds change, so shadows keep a steady sharpness.
- Hemisphere light for the soft sky fill. Neutral tone mapping so the palette colors stay true.

### Module layout
- `web/palette.ts`: colors, shared materials, canvas textures (window bay, road markings, hatch).
- `web/park-layout.ts`: pure functions with no Three.js: accent color index for a `cwd`, park bounds from used cell indexes, point and heading on the truck's road loop for a distance traveled, forklift position for a phase.
- `web/static-builder.ts`: collects static meshes of a lot by material and merges them with `mergeGeometries`, so a lot's static parts cost a handful of draw calls.
- `web/machines.ts`: `Smoke` (reusable puff pool), `Stacks`, `Forklift`, `Searchlight`, `CoolingTower`, `Truck`. Each exposes a `group` and `tick(dt, activity)`.
- `web/warehouse.ts`: subagent warehouse with small stack, roller door + pallet, rooftop lamp, rooftop fan.
- `web/lot.ts`: one session's yard, hall, machines, road truck, sign, and its warehouses (the slot logic moves here from `subagent.ts`). Replaces `factory.ts` and `subagent.ts`.
- `web/park.ts`: roads, trees, lamps, grass.
- `web/scene.ts`: orthographic camera, lights, composer.
- `web/main.ts`: same message handling, now creating `Lot`s and telling `Park` the used cells.
- `web/tooltip.ts`: only its import changes to a small `{ state, gone }` interface so it works for halls and warehouses.

### Animation mapping
All animations use the existing `Activity` class (0.3 s fade, 0.6 s minimum hold). Mapping by tool name stays in one table: `Edit`, `Write`, `NotebookEdit` → forklift; `Bash` → stacks; `Read`, `Grep`, `Glob` → searchlight; anything else → cooling tower.

- **Busy:** window glow via the wall material's emissive map (glass area only), thin smoke from stacks, road truck visible and driving.
- **Stacks:** rim material emissive intensity follows activity; smoke spawn rate and puff size increase.
- **Forklift:** moves along its path with a pallet on the forks, raising forks at each end. Its phase only advances while active, so it stops where it is.
- **Searchlight:** head turns in a slow sweep; the beam is an open cone with additive blending and a soft light pool decal on the ground. Its opacity follows activity. No real `SpotLight`, to avoid a light per lot.
- **Cooling tower:** larger, slower white steam puffs from the top.
- **Road truck:** travels a rectangular loop in the inner lane of the four roads around its lot, turning at corners. It scales in and out with busy activity.
- **Idle fade:** accent materials lerp toward grey and window glow goes to zero.
- **Session end:** the lot group sinks 12 units over 1 second, then is removed and its cell freed. Park rebuilds if bounds shrink.
- **Warehouse:** grows in and shrinks out like the old workshops, with the same busy and tool rules at small scale.

### Draw call budget
Target: under 800 WebGL draw calls per frame with 4 lots and 4 warehouses, counting shadow and ambient occlusion passes. Measured in the browser by counting `drawElements` and `drawArrays` calls.

Merging per material was not enough: the first build measured 891, because a lot uses about 18 materials and each object is drawn in three passes. `StaticBuilder` now bakes plain colored materials into vertex colors so they share one material and merge into a single mesh. Materials with textures, glow colors, transparency, or `userData.separate` (the animated accent color, and the roof so hovering finds the hall) keep their own mesh. Roads are merged into one mesh, stack rims into one, and a pine tree is one vertex colored geometry drawn with one `InstancedMesh`. Measured after: 427 draw calls per frame.

### Name labels
Name signs are HTML labels drawn with `CSS2DRenderer`, not sprites. `GTAOPass` drew sprites as dark boxes, and HTML labels also stay sharp and readable at every zoom. Three.js only sends the `removed` event to the removed object itself, so `Lot.dispose` removes the label element by hand.

### Intersections
The plain patches that hide crossing road dashes are flat planes. Thin boxes made ambient occlusion draw dark lines along their edges.

### Testing
- Vitest unit tests for `park-layout.ts`: same `cwd` gives the same accent, bounds cover every used cell plus one ring, the truck loop point is continuous at corners and wraps after a full lap, forklift position stays within its path.
- Existing `plots` and `activity` tests keep passing.
- Visual checks in agent-browser against real sessions, as in the first change. Headless test sessions must use `ping -c N 127.0.0.1` for long commands, because Claude Code blocks plain `sleep`.

## Risks / Trade-offs

- [Scene gets heavy with many lots] → merged static geometry, instancing, one smoke pool per machine, and the measured draw call budget. Ambient occlusion can be turned off if frame rate suffers.
- [Ambient occlusion looks noisy or haloed in an orthographic view] → tune `GTAOPass` radius and blend; if it still looks wrong, fall back to shadows and hemisphere light only and note it.
- [A 60 unit cell makes the town larger on screen] → orthographic zoom range allows seeing about 16 lots at once; the first view is fitted to the used cells.
- [Accent color alone may not tell folders apart when many share similar colors] → only 8 accents, so collisions happen after 8 folders; the name sign still tells lots apart.
- [Visual positions in the layout table may collide once built] → the table is a starting point; tuning is expected during the visual check tasks.
