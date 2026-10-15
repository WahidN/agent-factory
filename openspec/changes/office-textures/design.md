## Box UVs

`StaticBuilder` merges boxes per material. A box has UVs from 0 to 1 per face, so a texture on a 20 m floor would be stretched over the whole face.

Choice: scale the UVs by the box size in metres when a material has a map, so one texture tile covers a fixed size (for example 1 m). Materials without a map are untouched.

## Photos, not drawn

Textures drawn in code looked fake up close. CC0 photos at 512px cost about 375 KB in total and start loading when the page loads, long before you walk in. Both styles use `MeshStandardMaterial`, so both take a `map`.

## Leaves are geometry

Alpha cards would be the usual way to draw leaves, but the GTAO pass renders the scene with its own material and would see each card as a full square. Each leaf is a small folded mesh with an opaque leaf texture instead.

## Lifetime

The textures and their materials are module-level and shared by every office, like `MATERIALS`. They are never disposed, so closing one office cannot break the next.
