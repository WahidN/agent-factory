## Why

The office floor is a grey box with a window band: it works, but it does not look like anywhere. Our own office is a better room. It is an attic hall with a sloped ceiling, black ducts, ring lights, moss walls and oak floors, and the reference photos show how it is laid out.

## What Changes

- The room becomes one long attic hall. The ceiling slopes down on both long sides, is a rough grey, and carries black ducts, track rails with spots and ring pendant lights.
- The floor is oak, with a lighter carpet walkway down the middle from the door to the far end.
- The door end gets a moss wall with the white user name in letters and an olive green door, and a wall screen next to them.
- The desks are white sit-stand desks, two blocks of two columns on either side of the walkway. A wooden planter with plants stands between rows. One desk per session, one robot per desk, unchanged.
- One long side has a glass meeting-room wall with black frames. The other side has a diagonal wooden slat partition and a half-round window with sky.
- The far end has a kitchen block (white cabinets, grey island, black bins), a round table with black chairs under a triangle window, and a long dark table with beige chairs.
- No people in the room.

Not in this change: new behaviour. Walking, collision rules, robots, subagents, busy and idle poses, the card, the fade and the leave control stay as they are. The room is still built from boxes and cylinders in the existing ink style, so it reads as the same world, not as a photo.

## Capabilities

### New Capabilities

- `office-look`: what the office floor looks like and where things stand in it.

### Modified Capabilities

None. `office-interior` is still in the open change `add-enterable-office`, so this change adds its own capability instead of editing one that is not in the main specs yet.

## Impact

- Web: `web/office.ts` (shell and furniture), `web/office-layout.ts` (room size, desk spots, new zone spots, tested), `web/tests/office-layout.test.ts`.
- Maybe `web/palette.ts` for a few new shared materials (oak, moss, olive, ceiling grey).
- No server change, no new message, no new dependency.
- Builds on `add-enterable-office`. This branch starts from it.
- Docs: new screenshot in `docs/` and the README section on going inside.
