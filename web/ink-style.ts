// Shared shader treatment for the "Nijmegen Inkshift" look.
//
// We keep MeshStandardMaterial instead of swapping every object to a bespoke
// shader. That preserves vertex colors, instancing, maps, emissive windows,
// shadows and the existing material API, while a single four-step ramp turns
// the physically-lit result into graphic anime-style value blocks.

import * as THREE from "three";

const INK_STYLE_KEY = "nijmegen-inkshift-v1";

export function inkStyleRequested(search = globalThis.location?.search ?? "") {
  return new URLSearchParams(search).get("style") === "ink";
}

export const INK_STYLE_ENABLED = inkStyleRequested();

export const INK_BANDS = [0.18, 0.34, 0.55, 0.78] as const;

function makeRampTexture() {
  const values = new Uint8Array(INK_BANDS.map((value) => Math.round(value * 255)));
  const texture = new THREE.DataTexture(values, values.length, 1, THREE.RedFormat);
  texture.name = "Nijmegen Inkshift four-band ramp";
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

// One immutable ramp is shared by all standard materials and draw calls.
export const INK_RAMP = makeRampTexture();

export function applyInkShading(material: THREE.MeshStandardMaterial) {
  if (material.userData.inkStyle === INK_STYLE_KEY) return material;

  const compile = material.onBeforeCompile.bind(material);
  const cacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.uniforms.inkRamp = { value: INK_RAMP };
    shader.fragmentShader = `uniform sampler2D inkRamp;\n${shader.fragmentShader}`.replace(
      "#include <output_fragment>",
      `// Quantize perceived brightness before tone mapping. Converting to and
      // from a soft Reinhard curve keeps the ramp useful under bright sunlight.
      float inkLuma = max(dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)), 0.0001);
      float inkPerceived = inkLuma / (inkLuma + 0.65);
      float inkBand = texture2D(inkRamp, vec2(inkPerceived, 0.5)).r;
      float inkTargetLuma = (inkBand * 0.65) / max(1.0 - inkBand, 0.01);
      outgoingLight *= inkTargetLuma / inkLuma;
      #include <output_fragment>`,
    );
  };
  material.customProgramCacheKey = () => `${cacheKey()}-${INK_STYLE_KEY}`;
  material.userData.inkStyle = INK_STYLE_KEY;
  material.needsUpdate = true;
  return material;
}

export function inkStandardMaterial(
  color: THREE.ColorRepresentation,
  extra: THREE.MeshStandardMaterialParameters = {},
) {
  return applyInkShading(
    new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, flatShading: true, ...extra }),
  );
}
