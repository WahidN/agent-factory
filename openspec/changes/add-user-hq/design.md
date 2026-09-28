## Context

See proposal.md for why. The requirements are in `specs/factory-scene/spec.md`.

`web/plots.ts` hands every session a rank. `assignPlots` groups the sessions by user, sorts the users and each user's sessions by hash, and packs the result into 0..n-1 with no gaps. A rank is turned into a cell by `city-plan.ts`, which skips the cells the plan claimed, and then into a position on a Hilbert curve, so one user's run of ranks lands in a compact blob. `PlotAllocator` caches that map and recomputes it whenever a session is added or released.

`main.ts` reads the allocator in three places: `syncPlaces()` for where each session stands, `refocus()` for everything built per cell (roads, sidewalks, lamps, trees, the traffic graph, the camera extent, the claimed cells the city plan adds), and `redistribute()` for which sessions get a full `Lot`. Only the nearest few sessions are a `Lot`; the rest come out of one instanced mesh in `instanced-lots.ts`.

`lot.ts` bakes everything into one static mesh per lot and rebuilds it in place when the tier, the model or the milestone index changes. `milestones.ts` holds ten builders in a `ROWS` array, index-aligned with `MILESTONES` in `milestone-ladder.ts`. Two of them (turbine, blimp) return an `Animated` that the lot ticks. `buildMilestones` takes a `MilestoneContext` with the lot's accent material and its hall box, which the helipad stands on and the blimp hangs over.

`.claude/rules/web-scene-lifecycle.md` applies to anything new in the scene: the invariant belongs in the function that builds the object, a deferred callback checks again before it frees shared state, and a `dispose()` must not free geometry other objects draw from.

## Goals / Non-Goals

**Goals:**
- One building per user, sharing the city's existing plumbing: roads, camera extent and the traffic graph reach the HQ without a second code path.
- The ladder stays one table in one file, so a row can never land in the yard and on the HQ at the same time, or in neither.
- The HQ costs nothing per frame beyond the turbine and the blimp it already had on the lot.

**Non-Goals:**
- A far level for the HQ. There are a handful of users, not 150, so every HQ is built in full.
- Workers, parked cars or traffic of its own.
- A tooltip. City landmarks are not hoverable either, and the ladder dialog already names every user's total.

## Decisions

### The HQ is a rank in the plot allocator

`assignPlots` returns `{ sessions, hqs }` instead of one map: the session ranks as today, plus one rank per user that has at least one session, handed out as the first rank of that user's run. `PlotAllocator` gains `hqIndexOf(user)` and folds both maps into `indexes()`.

Everything downstream that works in ranks then covers the HQ for free. `park.update` draws its roads, sidewalks, lamps and trees, `traffic.setRoads` and `mobility.setRoads` drive past it, `parkBounds` keeps it in frame, and the city plan counts it when it decides how much of Nijmegen to build. No call site outside `plots.ts` and `main.ts` learns that HQs exist.

- Alternative: HQ keys inside the session map, prefixed `hq:`. Rejected: a hub prefixes ids with the machine name, so a machine called `hq` could in theory collide with a user name, and every caller iterating the map would have to know the prefix.
- Alternative: a separate pool of cells outside the allocator. Rejected: the packing owns which cells are taken, so a second pool would have to repeat that logic and would still land on an occupied cell.

### First rank of the run, not the middle

The HQ takes the first rank of its user's run. Within one user's own churn that rank does not move: sessions are sorted by hash after the HQ, so starting or stopping a session shifts the sessions behind it and leaves the HQ where it is. The middle of the run would move the HQ on every session that starts.

The run start still shifts when an earlier user gains or loses a session, the same way every lot shifts today. That is what keeps the park compact and is not new here.

### Floors come from the ladder, not from the raw total

`hqFloors(tokens)` in `milestone-ladder.ts` is `milestoneIndex(tokens) + 1`, so 1 floor below 10M and 11 floors at 5B. It stays next to `milestoneIndex` and `parkedCarCount`, which are the other two pure lookups on the same ladder, and it gets a test like they do.

One floor per row means the rows that add nothing to the yard still show up, and it keeps one rebuild trigger for the whole HQ: the milestone index. A floor is `WALL_BAY.height`, the same 6 units a hall's row of windows is, so the window texture tiles on the tower exactly as it does on a hall. A full tower is then 67 units on a footprint of 20 by 18, against 19 for the biggest hall and about 37 for the Stevenskerk crown. That is the point: at 5B it is the tallest thing in the city, and the footprint keeps it from reading as a needle.

- Alternative: height on a log scale of the raw total. Rejected: the HQ would rebuild on every token update instead of only when a row is crossed, and no floor would ever feel earned.

### One row table, two entry points

`ROWS` in `milestones.ts` becomes ten entries of `{ at: "lot" | "hq", build }`, and `buildLotMilestones` and `buildHqMilestones` both walk that one array and skip what is not theirs. The index alignment with `MILESTONES` stays visible in a single place, which is what silently breaks if the ten rows are split over two arrays.

The helipad and the blimp keep taking their box through `MilestoneContext`; the HQ passes its tower footprint and roof height in the same shape the hall used. Two constants change with the move: the helipad centers on the box it is given instead of sitting in the back left corner, since an HQ roof has no vents to dodge, and the blimp's altitude becomes the roof height plus a fixed 12 instead of the absolute 30, which a tower of 66 would otherwise stand above.

### The name goes on the roof, through the sign the halls already use

`web/roof-sign.ts` builds extruded letters on a steel frame and every hall spells its model with it. It took a model id and called `modelLabel` itself; it now takes the text to spell, so the lot passes `modelLabel(model)` and the HQ passes the user. One sign, two callers, no second letter builder.

That module caches a geometry per character and shares it with every sign in the park, marking each letter mesh `sharedGeometry`. `Hq.disposeStructure` frees the geometry of everything it holds, so it has to skip those meshes the way `Lot.disposeStructure` does. Without that, rebuilding one HQ for a new floor takes the letter buffers away from every sign in the city.

### The HQ wears the user's wall tint

A lot's accent is the colour of its project, and a user has no single project. The HQ uses `WALL_TINTS[wallTintIndexFor(user)]`, the tint that already identifies that user on every hall around it, for the tower walls, the flag and the blimp.

### The tooltip learns a second shape

`web/tooltip.ts` read a `SessionState` off whatever the ray hit. An HQ has no session, so `Hoverable` becomes a union: a lot still hands over its `state`, an HQ hands over `{ user, agents, tokens }`. The two are told apart by the field, and each builds its own lines. The alternative, giving every hoverable a method that returns its lines, would move the lot's tooltip text into `lot.ts` for no gain here.

Only the tower answers the pointer. `StaticBuilder` bakes every plain material into one mesh, so the plaza, the lawns and the planters would come along with the accent parts. The HQ's accent material is therefore marked `separate`, which gives it a mesh of its own, and the pickables are that mesh plus the wall mesh. It is the same trick `Lot` uses, where the accent is separate because its colour animates.

### Lifecycle next to the lots, not inside them

`main.ts` keeps a `Map<string, Hq>` by user, kept in sync from `syncPlaces()`, which already runs whenever the session set changes. Creating an `Hq` sets its position, its floor count and its filter visibility in one place, so the camera can never promote or move anything into a half-configured state. A user whose last session is gone gets the same sink a lot gets, and its deferred callback checks that the user has not come back before it disposes, the way `remove()` in `main.ts` already checks `sessions.has(id)`.

The frame loop ticks the HQs next to the lots, for the turbine and the blimp. Shadows follow the `consumeShadowDirty()` pattern the lot and the warehouse use, so a rebuild or a finished rise redraws the shadow map once instead of every frame.

## Risks / Trade-offs

- A full tower is 67 units tall, taller than anything the scene has drawn so far → check the shadow camera frustum in `scene.ts` and the fog far plane against a 5B HQ before calling it done; the showcase park already has a 5B user.
- Every user costs a cell, so a park of 10 users grows by 10 cells → that is the same growth as 10 more sessions, and the packing keeps it compact. A hub with many users is the case to look at in the browser.
- `rankCount` no longer equals the number of sessions → no caller uses it as a session count. The number of sessions is read from `sessions.size` in the stats overlay and from `sessions` itself everywhere else. Worth a grep when applying.
- The scene and the ladder dialog could disagree about a user's total → both read the same `userTotals()` output in `main.ts`, and the spec pins the HQ to that number.
- A user running two machines gets one HQ at the higher of the two totals → the same rule the dialog already uses, so nothing new appears on screen that the dialog does not explain.

## Migration Plan

No persisted state, no wire change and no server change, so there is nothing to migrate. Rollback is dropping the branch.

One ordering note: this change's delta modifies "Token milestones", which still lives in the unarchived `add-token-milestones` change. Archive that one first, or its requirement will not be in the main spec when this change is archived.
