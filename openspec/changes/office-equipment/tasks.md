## 1. Layout

- [x] 1.1 Add spots for the printer, the whiteboard and a screen per meeting room (door-end room included) to `office-layout.ts`, with tests that they fit in the room and stay off the walkway

## 2. Kitchen

- [x] 2.1 Add `web/office-equipment.ts` with the espresso machine, kettle, toaster, microwave and dishwasher front
- [x] 2.2 Place them in `buildKitchen`: the three small ones on the counter, the microwave in the tall cabinet, the dishwasher next to the sink

## 3. Desks and hall

- [x] 3.1 Add a keyboard and a mouse to every desk in `Desk.build`
- [x] 3.2 Build a screen on a stand in every meeting room, with a blocker
- [x] 3.3 Build the printer and the whiteboard at the far end, with blockers
- [x] 3.4 Add a doorway with an open sliding glass door to every meeting room, with a door spot in `office-layout.ts` and a test. Give the glass between rooms a blocker, and stop `step` in `walk.ts` from throwing you to the far end of a thin wall
- [x] 3.5 Turn the meeting room tables to run down the room, legs at the short ends

## 4. Verify and docs

- [x] 4.1 Run lint, typecheck, tests and build, then walk the room in the browser at 1, 4 and 12 sessions, with screenshots of the kitchen, a desk, a meeting room and the far end
- [x] 4.2 Update the screenshots in `docs/` and the README section on going inside
