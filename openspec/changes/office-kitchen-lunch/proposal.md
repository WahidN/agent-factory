## Why

The far end of the office is 16 m deep but mostly bare floor. The kitchen is a white box with a counter, and there is one long table and one round table off to the sides. It does not read as a place where people make coffee and eat lunch together.

## What Changes

- The kitchen fills the far wall: tall fridge, upper and lower cabinets with door lines, a sink and hob on the counter, and a wood counter top.
- The kitchen island gets bar stools along its near side.
- A lunch island of tables stands in the open space: two long tables side by side with chairs down both outer sides. The old single long table is replaced by it.
- The round table and the triangle window stay as they are.
- The walkway down the middle stays free, and everything still has a blocker so you walk around it.

Not in this change: new behaviour, people, food or props that move. Desk zone, glass rooms, textures and plants stay as they are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `office-look`: the far end has a full kitchen and a lunch island.

## Impact

- Web: `web/office-layout.ts` (spots for the new pieces, tested), `web/office.ts` (`buildFarEnd`), `web/tests/office-layout.test.ts`.
- Maybe a new `web/office-kitchen.ts` if `office.ts` gets too long.
- No server change, no new dependency, no new asset.
