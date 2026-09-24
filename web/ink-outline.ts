// A single full-screen edge pass gives the whole city an inked silhouette.
// Unlike per-mesh outline geometry it adds no scene traversal, duplicated
// geometry or draw call per object. It keys off luminance changes between
// neighbouring pixels, so soft shading inside a surface gets a lighter line
// than a hard silhouette against the ground.

import * as THREE from "three";

export const INK_OUTLINE_SHADER = {
  name: "NijmegenInkOutline",
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    inkColor: { value: new THREE.Color("#17162d") },
    strength: { value: 0.72 },
    threshold: { value: 0.12 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform vec3 inkColor;
    uniform float strength;
    uniform float threshold;
    varying vec2 vUv;

    float luma(vec3 color) {
      return dot(color, vec3(0.2126, 0.7152, 0.0722));
    }

    void main() {
      vec2 px = 1.0 / resolution;
      vec4 source = texture2D(tDiffuse, vUv);
      float left = luma(texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb);
      float right = luma(texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb);
      float down = luma(texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb);
      float up = luma(texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb);
      float edge = length(vec2(right - left, up - down));
      edge = smoothstep(threshold, threshold * 2.2, edge) * strength;
      gl_FragColor = vec4(mix(source.rgb, inkColor, edge), source.a);
    }
  `,
};
