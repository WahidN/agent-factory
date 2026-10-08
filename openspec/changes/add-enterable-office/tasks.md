## 1. The server names its user

- [x] 1.1 Add an optional `user` to the `server-mode` message in `server/types.ts`, with a line on why a central leaves it out
- [x] 1.2 Fill it in `server/index.ts` from `config.user` when the mode is not central, and leave it out on a central
- [x] 1.3 Extend the server-mode test in `server/tests/index-token.test.ts`: a local server names its user, a central names none

## 2. Who you are, in the page

- [x] 2.1 Read `user` off the `server-mode` message in `web/main.ts` and keep it as `me`, empty until something says otherwise
- [x] 2.2 Export the showcase user from `web/showcase.ts` (`noor`, the one with the full ladder) and use it as `me` in showcase mode

## 3. Clicking your own HQ

- [x] 3.1 Let `createTooltip` hand back what it is hovering, so a click can ask without a second raycaster
- [x] 3.2 Add the pointerdown/pointerup pair in `web/main.ts`: within 4 px and 400 ms counts as a click, anything longer is a camera drag
- [x] 3.3 Open the card when that click landed on an `Hq` whose user is `me`, and never for another user, a lot or the ground
- [x] 3.4 Build the card in `web/index.html` and `web/style.css`: whose office it is, how many agents are inside, a way in, and a close. It follows the look of the filter panel
- [x] 3.5 Close the card on Escape, on a click outside it, and when the camera starts moving

## 4. The office floor

- [x] 4.1 New `web/office-layout.ts`: desk positions in rows of at most four with a walkway of 1.8 between the rows and 1.2 along the walls, the room's size from the desk count with the tower's 20 by 18 floor plate as its minimum, the spots beside a desk for up to four subagents, and the per-desk phase from `hashString`
- [x] 4.2 New `web/tests/office-layout.test.ts`: 1, 3, 9 and 30 desks stay inside the room, rows of four, the walkways keep their width, the room never drops below the floor plate, subagent spots do not land on the desk, and two ids give different phases
- [x] 4.3 New `web/robot.ts`: a boxy robot in the user's tint with a head, two arms and glowing eyes, at full size and at the smaller subagent size, with a busy pose that taps and an idle pose that sits still. It is seen from a metre away, so it needs more shape than a city worker
- [x] 4.4 New `web/office.ts`: the room with four walls, a ceiling and a window band, a desk with monitor and chair per session, the user's name on the wall with `web/roof-sign.ts`, and its own lights
- [x] 4.5 Give the office `setSessions()`, rebuilding a desk only when the session set or a subagent count changes, and `tick(dt, now)` for the robots and the monitors
- [x] 4.6 Let the office hand out the boxes that block a walker: the four walls and one box per desk, chair and robot, filled where those are built
- [x] 4.7 Follow `.claude/rules/web-scene-lifecycle.md`: everything about a desk set where the desk is built, no shared letter geometry freed in `dispose()`

## 5. Walking and looking

- [x] 5.1 New `web/walk.ts` with a pure `step(walker, keys, dt, blockers)`: keys to a direction in the camera's frame, normalised so two keys are not faster than one, x and z moved separately, and the walker pushed out of any box it lands in
- [x] 5.2 New `web/tests/walk.test.ts`: forward follows the heading, strafe is square to it, two keys are the same speed as one, a wall head on stops, a box at an angle slides, and a long frame never steps through a wall
- [x] 5.3 Wire `PointerLockControls` in `web/office.ts` for the look, with the walk on top of it, and eyes at 1.7
- [x] 5.4 Track keys by `code` (`KeyW` and `ArrowUp` alike), and clear them on `blur` and `visibilitychange` so a background tab does not keep walking

## 6. Going in and coming back

- [x] 6.1 Add `setStage(scene, camera)` to `web/scene.ts`: assign both to the `RenderPass` and the `GTAOPass`, set the pass's `PERSPECTIVE_CAMERA` define and flag the recompile, size the staged camera on resize, and disable the city controls while the city is off stage
- [x] 6.2 Turn `shadowMap.autoUpdate` on while the office is on stage and off again on the way out, flipping `needsUpdate` for the city you come back to
- [x] 6.3 Wire enter and leave in `web/main.ts`: build the office, swap the stage, ask for the pointer, and put the city back untouched on the way out
- [x] 6.4 Add the fade, the leave control and the look hint to `web/index.html` and `web/style.css`, with the stage swapped halfway through the fade
- [x] 6.5 Order Escape in one handler: the milestone dialog first, then the pointer lock the browser owns, then the card, then leaving the office
- [x] 6.6 While inside: `pickables()` returns nothing, the camera's redistribute check is skipped, and the city keeps ticking on the socket
- [x] 6.7 Keep feeding the office from where the HQs are synced, so a session that starts or ends while you are inside adds or removes a desk, and the last one leaves an empty floor

## 7. Verify

- [x] 7.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, and `pnpm knip`
- [x] 7.2 Open `?mode=showcase` with agent-browser: click the showcase user's HQ, go in, screenshot the room, and check one desk per session with the project colours of the city
- [x] 7.3 Walk the floor with WASD and screenshot from two spots: the walkways are wide enough, the walls hold, and a desk at an angle slides instead of stopping
- [x] 7.4 Check busy against idle in one shot: a busy robot taps with a glowing monitor, an idle one sits still in the dark, and two busy robots are not in step
- [x] 7.5 Check the Escape order by hand: pointer back first, then out of the office, and the city camera stands where it stood, to the pixel
- [x] 7.6 Check that a drag starting on your own HQ rotates the camera and opens nothing, and that another user's HQ opens nothing
- [x] 7.7 Check a local `pnpm dev` against a `pnpm hub`: your own HQ opens locally, no HQ opens on the central
- [x] 7.8 Add the section on going inside to `README.md`, with a screenshot from the floor

## 8. Seen up close

- [x] 8.1 Turn the desks round in `web/office-layout.ts`: the robot sits on the door side, so its screens face the room instead of its back
- [x] 8.2 Make the room a whole floor of the tower (30 by 26 at least) and fill the open part with a meeting table, chairs and plants
- [x] 8.3 Rebuild the robot in `web/robot.ts` as a smaller seated figure: thighs off the chair, shins to the floor, and a head that clears the desk
- [x] 8.4 Give the robot more to do: typing arms with the head and body leaning in, and an idle pose that sits back, looks around the room and breathes
- [x] 8.5 New `web/screen.ts`: a canvas per desk with a title bar, lines of work in the project's colour and a blinking cursor, redrawn 8 times a second while busy, dark and still when idle
- [x] 8.6 Put that one canvas on both the monitor and an open laptop in front of it, as map and emissive map, so the lit pixels are the pixels that glow
- [x] 8.7 New `web/hands.ts`: your own hands on the camera, swinging with the distance walked and not with the clock
- [x] 8.8 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, `pnpm knip`, and walk the showcase office again for the screens, the laptop, the hands and the seated robots
- [x] 8.9 Update the spec delta, the README section and the screenshot for all of it
