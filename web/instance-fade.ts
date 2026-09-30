// Vehicles fade out where their road ends instead of shrinking away, so one
// keeps its full size until it is gone.
//
// One instanced mesh draws every vehicle of a kind in a single call, so the
// opacity cannot live on the material. It rides along per instance in an
// `aFade` attribute wired into the baked material with onBeforeCompile, the
// way instanced-lots.ts feeds in its glow value.

import * as THREE from "three";
import { BAKED_MATERIAL } from "./static-builder.ts";

// The baked material, blended by the per-instance alpha. depthWrite stays on:
// an instance at full presence blends with nothing, so it still hides what is
// behind it, and the parts of a fading one keep hiding each other.
export const FADING_MATERIAL = fadingMaterial();

function fadingMaterial(): THREE.MeshStandardMaterial {
  const material = BAKED_MATERIAL.clone();
  material.transparent = true;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aFade;\nvarying float vFade;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvFade = aFade;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vFade;")
      .replace("#include <color_fragment>", "#include <color_fragment>\n\tdiffuseColor.a *= vFade;");
  };
  material.customProgramCacheKey = () => "instance-fade";
  return material;
}

/** The 0..1 opacity buffer of one mesh drawn with FADING_MATERIAL. */
export function fadeAttribute(mesh: THREE.InstancedMesh): THREE.InstancedBufferAttribute {
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count).fill(1), 1);
  fade.setUsage(THREE.DynamicDrawUsage);
  // The buffer belongs to this mesh alone, so it may not go onto a geometry
  // another mesh draws from.
  mesh.geometry = mesh.geometry.clone();
  mesh.geometry.setAttribute("aFade", fade);
  return fade;
}
