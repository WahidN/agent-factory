## Why

The office has furniture but no equipment. The kitchen counter is bare, the meeting rooms only hold a table, and a desk has a monitor and a laptop but nothing to type on. It looks like a showroom before move-in day, not a place where people work and make coffee.

## What Changes

- Kitchen: an espresso machine, a kettle and a toaster on the counter, a microwave built into the tall pantry cabinet, and a steel dishwasher front between the lower cabinets next to the sink.
- Desks: a keyboard and a mouse at every desk, on the monitor side. They come and go with the desk, so the count follows the number of sessions.
- Meeting rooms: a screen on a stand at the end of every meeting room table, the door-end room included.
- A printer: a floor-standing office printer at the far end, beside the walkway where the desk zone ends.
- A whiteboard on wheels next to the round table, with a few marker lines on it.
- The printer, the whiteboard and the screens get a blocker, so you walk around them. The walkway stays clear.
- Every meeting room gets a doorway in its glass wall, with a sliding glass door pushed open, so you can walk in. Today the glass runs unbroken and the rooms are closed.
- The meeting room tables turn to run down the length of the room. Today they stand across it, with the chairs half under the edge.

Not in this change: anything that moves or responds. The screens stay off, the printer prints nothing, the whiteboard has no text, and the door does not slide. The rest of the furniture, walking, robots and textures stay as they are. Everything is built from boxes and cylinders in the existing style.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `office-look`: the kitchen has appliances, every desk has a keyboard and a mouse, every meeting room has a screen, a doorway and a table along its length, and the hall has a printer and a whiteboard.

## Impact

- Web: new `web/office-equipment.ts` (the appliances and equipment, built into the office's `StaticBuilder`), `web/office.ts` (places them, the doorway in `glassWall`, the table direction), `web/office-layout.ts` (spots for the printer, whiteboard, screens and doorways, tested), `web/tests/office-layout.test.ts`, `web/walk.ts` and its test (a rounding fix, so a thin wall holds you instead of throwing you to its far end).
- No server change, no new dependency, no new asset.
- Builds on `office-kitchen-lunch` and `office-textures`, which are on this branch and not merged yet.
