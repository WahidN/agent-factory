## Own file, not office.ts

`office.ts` is about 710 lines. The kitchen, desk and hall pieces add roughly 100 more.

Choice: a new `web/office-equipment.ts` with one function per piece that draws it into a `StaticBuilder` at a spot, like `addPlant` in `office-plants.ts`. `office.ts` decides where things go and pushes the blockers, as it does for every other piece.

## Merged, not separate meshes

Every piece goes through the office's `StaticBuilder`, so it merges into the meshes the room already has per material. Thirty desks with a keyboard and a mouse each cost no extra draw calls. A keyboard is one box with a lighter key face on top, like the laptop.

## Screens on a stand

The meeting rooms along the desk zone have glass on three sides and a half-round window in the outer wall, so there is no wall to hang a screen on. A screen on a floor stand at the short end of the table works in every room, the door-end room included, and keeps the window free.

The screens are off: a dark glass face, like the wall screen at the door. A live picture would need a canvas per room and has no data to show.

## A doorway, not a door that opens

The glass wall gets an opening at the door end of each room, with a glass transom above it. The door leaf stands slid open on the room side, in front of the fixed pane next to the opening. It sits inside that pane's blocker, so it needs no blocker of its own and nothing has to animate.

With a way in, the glass between two rooms is now reachable, so it gets a blocker too. That showed a rounding bug in `walk.ts`: a walker pushed out against a thin box stood a hair inside it on the next step and was thrown along the box to its far end. `pushOut` now treats the edge itself as outside.

## Spots in office-layout.ts

The printer, the whiteboard and the screens stand on the floor, so they need blockers and must keep the walkway free. Their spots go in `office-layout.ts` (`zoneSpots` and a screen spot per meeting room), where a test can check that they fit in the room and stay off the walkway. The kitchen appliances stand on or inside the cabinet run, which already has a blocker, so they are placed in `buildKitchen` relative to the counter.
