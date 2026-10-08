## Context

See proposal.md for why. The requirements are in `specs/office-interior/spec.md` and `specs/agent-tracking/spec.md`.

`web/scene.ts` builds one renderer, one orthographic camera at a fixed isometric angle, one `OrbitControls`, and an `EffectComposer` with a `RenderPass`, a `GTAOPass`, the ink outline `ShaderPass` and an `OutputPass`. The render loop drives everything through `onFrame` callbacks. `focus(x, z, half, fit)` moves the orbit target, sizes the sun's shadow area and the fog, and sets the zoom floor; `clampToPark` in the controls' change handler keeps the target inside the area `focus` was last given. The shadow map has `autoUpdate` off: anything that moves a caster flips `needsUpdate`.

`web/main.ts` owns the session set, the plot allocator, the lots, the HQs and the filter. It builds the tooltip with a fixed camera and a `pickables()` callback, and ticks everything in one `onFrame`. The `server-mode` message is taken off the socket there, before `handle()`, because it is the one message that is not a `ParkMessage`.

`web/hq.ts` builds a tower per user and marks its own meshes `userData.hover = this`, which is how the tooltip finds it. `add-user-hq` is the change that put it there, and this change builds on that branch.

`.claude/rules/web-scene-lifecycle.md` applies to the office too: an invariant belongs in the function that builds the object, and a `dispose()` may not free geometry that other objects draw from.

## Goals / Non-Goals

**Goals:**
- One renderer and one set of passes. The office is a second scene with a camera of its own, so the ink style comes for free while the view inside can be a first person one.
- Leaving is exact: the city camera is never touched while you are inside, so coming back needs nothing put back.
- The office knows nothing about the city, and the city knows nothing about the office. `main.ts` is the only file that holds both.
- Pure maths in their own files with tests, the way `worker-logic.ts` sits next to `workers.ts`: the desk layout, and the step a walker takes against what blocks it.

**Non-Goals:**
- A far level or an instanced office. Only your own office can be entered, so there is at most one, built only while you are in it.
- Reading a session's tool, model or tokens inside. The city already shows that; the office shows who is working.
- Any state that survives a reload. Going in is not a route and not a URL.
- A physics engine, gravity, jumping, stairs or a navmesh. The floor is flat and the walker is a circle that slides along boxes.

## Decisions

### The server names its user on the message it already sends

`server-mode` gains an optional `user`. `server/index.ts` fills it with `config.user` when the mode is not central, and leaves it out on a central. The browser stores it as `me` and enters only an HQ of that user.

That message already arrives before the first lots and already carries the one thing the page cannot work out for itself. A second message would double the handshake for one string. The name is not new information either: every session of that machine already carries the same `user`, so nothing about a machine leaves it that did not leave it before.

- Alternative: the username the filter panel's "jump to me" box holds, kept in `localStorage`. Rejected: the central switches that panel off, so the one place with many users would have no way to set it, and a typo would hand you someone else's office.
- Alternative: a query parameter. Rejected: the wall display and the shared link would carry someone's name around with them.

Showcase has no socket, so `web/showcase.ts` exports the user it counts as yours, `noor`, the one with the full ladder. That keeps `?mode=showcase` a complete review scene: it is how the README screenshots are made.

### A click is a pointerdown and a pointerup that did not travel

`OrbitControls` owns dragging on the same canvas, and a rotate that starts and ends on the tower would otherwise open the card every time. `main.ts` records the pointerdown position and treats the pointerup as a click when it lands within 4 px and 400 ms of it.

The hit itself comes from the tooltip, which already raycasts against the same pickables and already knows what is under the pointer. The tooltip returns its current target, and `main.ts` asks whether that is an `Hq` of `me`. A second raycaster in a second file would have to be kept in step with the first one's cache invalidation.

- Alternative: a `click` listener on the canvas. Rejected: it fires after a drag as well, which is exactly the case this has to tell apart.

### Two scenes and two cameras, swapped at the passes

`createScene` gains `setStage(scene, camera)`: it assigns both to the `RenderPass` and to the `GTAOPass`, remembers which camera is on stage so `resize()` sizes the right one, and disables the city's `OrbitControls` while the stage is not the city. Both passes read `scene` and `camera` on every render, so assigning them is enough; the ink outline is a screen space pass over the finished image and needs nothing.

The city camera is not touched at all while you are inside, which is what makes coming back exact: there is no saved state to restore, only a stage to swap back.

`GTAOPass` is the one catch. It reads `this.scene` and `this.camera` per render, but it bakes `PERSPECTIVE_CAMERA` into a shader define in its constructor, from the camera it was built with. `setStage` therefore sets that define from the new camera and flags the material for a recompile. That recompile happens once per swap, behind the fade.

- Alternative: a second `EffectComposer` for the office. Rejected: GTAO keeps a depth and a normal target at screen size, and a second one would cost that memory for a room that is on screen half a minute at a time.
- Alternative: an orthographic camera inside too, so nothing about the passes changes. Rejected: eye height is the point, and an orthographic view from eye height inside a room reads as a flat wall.

The office scene sets its own background and leaves `fog` null. Its camera is a perspective one with a 70 degree field of view, near 0.1 and far 200, which covers a room of at most a few dozen metres.

### First person: pointer lock for looking, keys for walking

Looking uses `PointerLockControls` from the three addons: it owns the yaw and pitch of the office camera, clamps the pitch and never rolls. Walking is this project's own code, because the addon has no movement.

Pointer lock is what makes a mouse look work without the cursor running off the window, and the browser gives Escape back for free. That fixes the order: Escape releases the pointer, and the next Escape leaves the office. A hint on screen says so, and the leave control stays visible and clickable whenever the pointer is free.

- Alternative: hold the left button and drag to look, no pointer lock. Rejected: you cannot walk and look at once, which is the whole feel of standing in the room.
- Alternative: `FirstPersonControls` from the addons. Rejected: it steers with the pointer's position near the window edge, has no pointer lock and brings its own key handling that this needs to override anyway.

Keys are tracked by `code` (`KeyW`, `ArrowUp`), so a different keyboard layout still walks. A `blur` on the window and a `visibilitychange` clear the held keys, or you keep walking while the tab is in the background.

### Walking is a pure step against a list of boxes

`web/walk.ts` holds a pure `step(walker, keys, dt, blockers)`: it turns the held keys into a direction in the camera's frame, normalises it so two keys are not faster than one, moves x and z separately, and pushes the walker out of any box it ends up inside on that axis. Moving per axis is what makes walking into a desk at an angle slide along it instead of stopping dead.

The walker is a circle of 0.35 with its eye at 1.7, in a world where a worker in the city stands 1.9 units tall, so one unit is a metre. Blockers are axis aligned boxes: the four walls, and one box per desk, chair and robot, handed over by `office.ts` when it builds them. There is no gravity and no step height, so the floor stays flat and the maths stays testable without Three.js.

- Alternative: raycasting against the room's meshes. Rejected: a ray per frame per direction against merged geometry, for boxes that are known the moment they are built.

### The office is built when you go in and disposed when you leave

`web/office.ts` builds the room on `enter()` and frees it on `leave()`. Nothing of it exists while you are in the city. The room is a handful of merged boxes: cheaper to rebuild than to keep a scene graph in sync with sessions you are not looking at.

While you are inside, `main.ts` keeps feeding it: `setSessions()` runs from the same place the HQs are synced, so a session that starts adds a desk. A desk is rebuilt only when the session set or a session's subagent count changes. Status is a pose and a material, so a session going idle never rebuilds anything.

Everything about a desk is set in the function that builds it, per the scene lifecycle rule: its position, its project colour, its robot's pose and its subagent robots. There is no second place that patches a desk after the fact.

### Pure geometry in `office-layout.ts`

Desk positions, the room's size from the desk count, the spots beside a desk for its subagents, and the per-desk animation phase are pure functions with no Three.js, tested like `park-layout.ts`. Desks go in rows of at most four, with a walkway of 1.8 between the rows and 1.2 along the walls, so every desk can be walked up to. The room grows with the rows and never shrinks below the tower's own 20 by 18 floor plate, so a one desk office is still a room and not a cupboard. The phase is the session id's hash, the same `hashString` the plot allocator uses, so two busy robots never tap in step and a robot keeps its phase when a neighbour leaves.

### Inside, the shadow map redraws every frame

In the city `shadowMap.autoUpdate` is off, because nothing that matters moves and a redraw costs a pass over 150 lots. The office is one small room with one shadow casting light, seen from a metre away, where a robot without a shadow under it is obvious. `autoUpdate` is therefore turned on while the office is on stage and turned off again on the way out, with `needsUpdate` flipped once so the city's own map is redrawn for the view you come back to.

### The city keeps running while you are inside

The frame loop still ticks the lots, the traffic and the HQs, and the socket still arrives in `handle()`. Nothing has to catch up when you come back, and the city is never a snapshot from a minute ago.

Two things are switched off: `pickables()` returns an empty array, so the tooltip cannot hover a city building that is not on screen, and the camera's redistribute check is skipped, because the ground centre the parked city camera reports has nothing to do with what is drawn.

### Who gets Escape

Three things want it, so the key handler in `main.ts` reads them in one order and stops at the first that applies. The milestone dialog is a native `<dialog>` and handles its own Escape, so the handler leaves it alone while that is open. The browser owns Escape while the pointer is locked, and releases the lock itself. Then the card, if it is open. Then the office, if it is on screen.

## Risks / Trade-offs

- Assigning `scene`, `camera` and the perspective define on a `GTAOPass` is not in its documented API → the installed three r186 reads `this.scene` and `this.camera` inside `render()` and re-copies the camera uniforms per frame, so the swap holds for this version; a three upgrade has to be checked in the browser. The fallback is turning the AO pass off while the office is on stage.
- The view inside is perspective while the whole rest of the project is orthographic → that is the point of standing in the room, and the fade covers the switch. If it reads as a different app, the field of view comes down before anything else changes.
- Pointer lock can be refused: browsers block a new lock for about a second after Escape released one → the hint stays on screen and a click asks again, so a refused lock is never a dead end.
- A held key plus a long frame could step a walker through a wall → the step is clamped to the frame time, a walking pace is 3.2 a second, and walls are boxes half a unit thick, so a single step never crosses one.
- A user with many sessions gets a big room to walk through → desks in rows of four keep it roughly square, and 30 sessions is 8 rows. Worth walking with `SESSIONS_PER_SPOKE=30`.
- The office is the first thing in this project that swallows a click, and `OrbitControls` rotation starts on the same button → the 4 px threshold decides it, and a rotate that starts on the tower must be checked by hand in the browser.
- `?mode=showcase` names a user who does not exist on anyone's machine → it only ever matches showcase sessions, and a real page gets its user from the server.
- The interior's look is new work, not a variation on something already in the repo → the parts are the ones the city already uses (merged boxes, the shared wall tints, the project accent), and the room is reviewed in the browser before it is called done.

## Migration Plan

No persisted state, no schema and no new message. A page and a server can be upgraded in either order: a browser that gets no user simply has nothing to enter, and a server sending one to an older page is ignored. Rollback is dropping the branch.

Ordering: this change sits on `add-user-hq`, which is not archived yet. Its `factory-scene` delta must land first, since there is no HQ to click without it.
