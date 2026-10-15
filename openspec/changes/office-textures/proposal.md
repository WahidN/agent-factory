## Why

The office is built from flat-shaded boxes. The moss wall is 70 small boxes, the floor and ceiling are one flat colour each, and the plants are green cones. It reads as blocks, not as a room.

## What Changes

- The moss wall becomes one wall with a photo moss texture and a normal map, and the 70 boxes go away.
- The oak floor, carpet walkway and ceiling get photo textures. Planters and wooden tables share the oak texture.
- The plants become leafy plants: folded, drooping leaves with a drawn leaf texture, in three kinds (rubber plant, fern, bushy) and three greens.
- The textures are CC0 photos from ambientCG, shrunk to 512px JPG (about 375 KB in total) in `web/public/textures/`.

Not in this change: baked lighting or AO, and anything outside the office. Layout, walking, robots and the ink style stay as they are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `office-look`: the moss wall, oak, walkway and ceiling have a photo texture, and the plants have leaves.

## Impact

- Web: `web/office.ts`, `web/static-builder.ts` (UVs that follow the size of a box), `web/office-textures.ts` (loads the photos), `web/office-plants.ts` (leaves and plants), `web/palette.ts` (exports `canvasTexture`).
- Assets: `web/public/textures/` with a README that credits ambientCG (CC0).
- No server change, no new dependency.
