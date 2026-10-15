## Why

The city shows what your agents do from the outside: a hall smokes, a tower grows a floor. Your own sessions are the ones you actually want to look at, and from above they are four grey roofs like everyone else's. Stepping into your own head office turns that roof into a room you can read: one desk per session, one robot per desk, and you can see at a glance which of your agents is working and which is sitting still.

## What Changes

- The server names its own user to the browser. A local server sends its `USER` in the `server-mode` message it already sends on connect. A central sends no user, because it serves the whole office and has no single owner. A page that is told no user has no HQ to enter and behaves exactly as it does today.
- Clicking the HQ of that user opens a small card: whose office it is, how many agents are inside, and a button to go in. Clicking anywhere else, pressing Escape or dragging the camera closes the card. Every other HQ stays a building you can only hover.
- Going in fades the city out and puts you on the office floor, standing in the room at eye height. The office is its own scene, drawn by the same renderer and the same ink style, so it reads as the same world seen from the inside. The city is left exactly as it was and comes straight back when you walk out.
- You walk with WASD and look around with the mouse. The walls, the desks and the robots stop you, so you stay on the floor and do not walk through the furniture. Looking around takes the pointer; Escape gives it back, and Escape again leaves the office. The leave control is on screen the whole time.
- The office floor is a room with four walls, a ceiling and a window band, and one desk per session of that user, laid out in rows with walkways wide enough to get between them. A desk holds a monitor in the session's project colour, a chair, and a robot behind it. The room and the name on the wall are in the user's own tint, the same tint the halls and the tower outside use.
- A robot works when its session is busy: it taps the desk, its head bobs and its monitor glows. An idle session's robot sits still with a dark screen. A session's subagents stand next to its desk as smaller robots, up to four, the same cap the yard's warehouses use.
- Sessions that start or stop while you are inside add or remove a desk. Your last session ending empties the floor, and the office stays open until you walk out.
- Showcase mode (`?mode=showcase`) names a fixed user as you, so the card, the office and the robots can be reviewed and screenshotted without a running session.
- README: a section on going inside, with a screenshot.

Not in this change: hovering a robot for session details, a lift or more than one floor, an office for a user that is not you, anything in the room that the token ladder unlocks, walking out of the office into the street, and jumping, crouching or running.

## Capabilities

### New Capabilities

- `office-interior`: entering and leaving your own HQ, what the office floor holds, and how a robot follows its session.

### Modified Capabilities

- `agent-tracking`: the server tells a browser which user its sessions belong to, and a central deliberately does not.

## Impact

- Web: new `web/office.ts` (the room, its desks and its lifecycle), `web/office-layout.ts` (pure desk, walkway and room geometry, tested), `web/walk.ts` (the first person camera: keys, mouse look and what blocks you, with the movement itself pure and tested), `web/robot.ts` (the robot and its two poses). Changed: `web/scene.ts` (which scene and which camera the passes draw), `web/main.ts` (who you are, the click on your HQ, feeding the office your sessions), `web/showcase.ts` (a fixed user), `web/index.html` and `web/style.css` (the card, the leave button, the look hint, the fade).
- Server: `server/types.ts` and `server/index.ts` gain one optional field on the `server-mode` message. No new message, no change to what a reporter sends, and nothing new leaves a machine: the user name is already on every session.
- Tests: the desk and room layout in `web/tests/office-layout.test.ts`, walking and what blocks it in `web/tests/walk.test.ts`, and the server naming its user only outside central mode in `server/tests/`.
- Docs: `README.md`.
- Builds on `add-user-hq`, which puts the HQ in the city. Without that change there is nothing to click.
