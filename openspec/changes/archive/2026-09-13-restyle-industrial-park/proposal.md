## Why

The first version reads as a cartoon toy town. The wanted look is a detailed low-poly industrial park, like the Unity asset store screenshot the user shared: grey flat-roof halls with a colored base stripe and window grids, asphalt yards with markings, forklifts and trucks, chimney stacks on steel frames, a cooling tower, pine trees, and soft ambient-occlusion shading.

## What Changes

- Each session becomes a fenced industrial lot on a road grid, with trees and street lamps between lots, instead of a small factory on a grass plot.
- The main building becomes a grey flat-roof hall with window grids, rooftop vents, a loading dock, and a colored base stripe.
- **BREAKING (visual):** tool animations move to new machines: Bash → orange-top chimney stacks, Edit/Write → forklift loading a truck, Read/Grep/Glob → searchlight on a lattice tower, other tools → small cooling tower steam. The robot arm, furnace door, radar dish, and wall gear are removed.
- While a session is busy, windows light up and a truck drives the roads around its lot.
- Subagents become small warehouses inside the parent's yard, with a small version of each tool animation.
- Sessions in the same folder share an accent color (base stripe, dock door, sign bar) instead of a roof color.
- Camera becomes an isometric-style view with rotate and zoom, like the reference.
- Soft ambient occlusion and softer shadows to get closer to the reference's lighting.
- No server changes. The `agent-tracking` capability is untouched.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `factory-scene`: session lots on a road grid instead of plots on grass, new building look, new tool to machine mapping, subagent warehouses instead of workshops, folder accent color instead of roof color, isometric-style default camera.

## Impact

- Web code only: `web/factory.ts` and `web/subagent.ts` are replaced by new lot, machine, warehouse, and park modules; `web/scene.ts`, `web/plots.ts`, and `web/main.ts` change. `web/activity.ts`, `web/tooltip.ts`, and the server stay as they are.
- No new npm dependencies: ambient occlusion uses `GTAOPass` from `three/addons`.
- More meshes per session, so static parts are merged and repeated parts (trees, windows, vents) are instanced to keep frame rate smooth.
