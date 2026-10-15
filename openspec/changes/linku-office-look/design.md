## Context

`web/office.ts` builds a box room (`buildShell`, `buildFurniture`) and `web/office-layout.ts` holds the pure desk geometry with tests. Walking collides with a list of boxes (`blockers`). The look has to stay in the same low-poly ink style as the city, so this is boxes, cylinders and cones, not textures from the photos.

## Decisions

**Hall runs along z, door at +z.** The door stays where it is, so `doorSpot` and walking in need no change. Width is fixed at about 22, depth grows with the desk rows. Plan, door at the bottom:

```
 far end (-z):  [kitchen]  [round table]  [long table]   triangle window
                 ........ glass rooms (-x) | slat partition (+x) ........
 desks:          [D D] | walkway | [D D]     planters between rows
 door end (+z):  moss wall + name + green doors + screen
```

**Layout stays pure.** `officeRoom`, `deskSpots` and new spot functions for the zones live in `office-layout.ts` so they are unit-tested. `office.ts` only turns spots into geometry. `COLUMNS` stays 4, but columns split 2 and 2 around a walkway gap.

**Sloped ceiling as two slanted boxes.** One tilted box per long side, plus a flat strip over the walkway. Cheaper and clearer than a lofted mesh. Ducts are dark cylinders, ring lights are torus meshes with an emissive material.

**Skylight, not window texture.** Triangle and half-round windows are flat shapes in the sky colour with a black frame, set into the slope or end wall. No real view.

**New materials go in `palette.ts`** only where several parts share them (oak, moss, olive, ceiling grey). One-off colours stay local, like `carpet` today.

**Shadows.** Keep the current rule: ceiling, walls and lights do not cast, so the one sun light still reaches the floor.

## Risks

- A long hall with many parts can cost draw calls. All still pieces go through `StaticBuilder`, which merges them, so the count stays about the same.
- Slanted ceilings hide in the first person view if the slope starts too low. Keep the walkway edge higher than eye height plus a margin, and check with a screenshot.

## Assumptions

- The moss wall spells the user's name, as the sign does today, and not a fixed company name.
- "Without the people" means the photos' people are left out, and the room stays staffed by robots only.
