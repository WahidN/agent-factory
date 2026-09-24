import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { inkStandardMaterial, inkStyleRequested } from "../ink-style.ts";

describe("Nijmegen Inkshift materials", () => {
  it("uses Inkshift by default and allows an explicit classic fallback", () => {
    expect(inkStyleRequested("?mode=showcase&style=ink")).toBe(true);
    expect(inkStyleRequested("?mode=showcase")).toBe(true);
    expect(inkStyleRequested("")).toBe(true);
    expect(inkStyleRequested("?style=classic")).toBe(false);
  });

  it("keeps standard material features and leaves three's shader untouched", () => {
    const material = inkStandardMaterial("#ffffff", { vertexColors: true });
    const shader = {
      uniforms: {},
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    } as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.vertexColors).toBe(true);
    expect(material.flatShading).toBe(true);
    expect(shader.fragmentShader).toBe(THREE.ShaderLib.standard.fragmentShader);
  });
});
