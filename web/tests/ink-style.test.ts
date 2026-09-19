import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { applyInkShading, INK_BANDS, INK_RAMP, inkStandardMaterial, inkStyleRequested } from "../ink-style.ts";

describe("Nijmegen Inkshift materials", () => {
  it("only opts in through the explicit URL style", () => {
    expect(inkStyleRequested("?mode=showcase&style=ink")).toBe(true);
    expect(inkStyleRequested("?mode=showcase")).toBe(false);
    expect(inkStyleRequested("?style=classic")).toBe(false);
  });

  it("shares one nearest-filtered four-band ramp", () => {
    expect(INK_BANDS).toHaveLength(4);
    expect(INK_RAMP.image.width).toBe(4);
    expect(INK_RAMP.minFilter).toBe(THREE.NearestFilter);
    expect(INK_RAMP.magFilter).toBe(THREE.NearestFilter);
  });

  it("keeps standard material features and injects the shared ramp", () => {
    const material = inkStandardMaterial("#ffffff", { vertexColors: true });
    const shader = {
      uniforms: {},
      fragmentShader: "void main() { #include <output_fragment> }",
    } as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.vertexColors).toBe(true);
    expect(shader.uniforms.inkRamp.value).toBe(INK_RAMP);
    expect(shader.fragmentShader).toContain("inkTargetLuma");
  });

  it("is idempotent when a shared material is encountered twice", () => {
    const material = new THREE.MeshStandardMaterial();
    applyInkShading(material);
    const compile = material.onBeforeCompile;
    applyInkShading(material);
    expect(material.onBeforeCompile).toBe(compile);
    expect(material.customProgramCacheKey()).toContain("nijmegen-inkshift-v1");
  });
});
