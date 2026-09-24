// Material defaults for the "Nijmegen Inkshift" look.
//
// The look comes from the Inkshift palette and the full-screen outline pass
// (ink-outline.ts). Materials stay plain MeshStandardMaterial, which keeps
// vertex colors, instancing, maps, emissive windows and shadows working.
// There is no toon ramp: banded shading muddies the overview and flattens the
// contrast between buildings and roads.

import * as THREE from "three";

export function inkStyleRequested(search = globalThis.location?.search ?? "") {
  // Inkshift is the default visual language. Keep the original renderer
  // available as an explicit comparison/debug escape hatch.
  return new URLSearchParams(search).get("style") !== "classic";
}

export const INK_STYLE_ENABLED = inkStyleRequested();

export function inkStandardMaterial(
  color: THREE.ColorRepresentation,
  extra: THREE.MeshStandardMaterialParameters = {},
) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, flatShading: true, ...extra });
}
