// A lit sign box on the hall's front wall showing the machine's face, like a
// company logo above a factory entrance. It glows with the session's activity,
// the same way the windows do.

import * as THREE from "three";
import { COLORS, MATERIALS, standard } from "./palette.ts";
import { drawAvatarCircle, loadAvatar } from "./avatar.ts";
import { machineSlug, initialsFor } from "./sign-text.ts";

const CANVAS_SIZE = 512;
const HOUSING_DEPTH = 0.35;
const FRONT_Z = 0.18; // just in front of the housing (housing front face is at depth/2)
const RIM_Z = 0.177; // between the housing face and the glowing front

export class LightBox {
  // Add to the lot structure; the caller sets position and rotation. The box
  // faces +z in local space.
  readonly group: THREE.Group;
  // Meshes the caller may mark hoverable.
  readonly pickables: THREE.Mesh[];

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private frontMaterial: THREE.MeshStandardMaterial;
  private rimMaterial: THREE.MeshStandardMaterial;
  private ownGeometries: THREE.BufferGeometry[] = [];
  private accent: THREE.Color;
  private machine: string | null = null;
  private token = 0; // bumped on dispose/machine change so a late onload draws nothing
  private disposed = false;

  // `size` is the box's width and height in world units; `accent` is the lot's
  // accent color, used for the initials fallback.
  constructor(accent: THREE.Color, size: number) {
    this.accent = accent;
    this.group = new THREE.Group();

    this.canvas = document.createElement("canvas");
    this.canvas.width = CANVAS_SIZE;
    this.canvas.height = CANVAS_SIZE;
    this.ctx = this.canvas.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    // Housing, shared dark steel material (never disposed by this class).
    const housingGeometry = new THREE.BoxGeometry(size, size, HOUSING_DEPTH);
    const housing = new THREE.Mesh(housingGeometry, MATERIALS.darkSteel);
    housing.castShadow = true;
    this.group.add(housing);
    this.ownGeometries.push(housingGeometry);

    // Thin accent rim around the glowing front. Own material (accent color).
    this.rimMaterial = standard(accent, { roughness: 0.6 });
    const rimGeometry = new THREE.PlaneGeometry(size * 0.9, size * 0.9);
    const rim = new THREE.Mesh(rimGeometry, this.rimMaterial);
    rim.position.set(0, 0, RIM_Z);
    this.group.add(rim);
    this.ownGeometries.push(rimGeometry);

    // Glowing front: the same canvas texture drives both the visible color
    // and the emissive glow, so the face is legible dark and lit.
    this.frontMaterial = new THREE.MeshStandardMaterial({
      map: this.texture,
      emissiveMap: this.texture,
      emissive: new THREE.Color(COLORS.windowLight),
      emissiveIntensity: 0,
      roughness: 0.8,
    });
    const frontGeometry = new THREE.PlaneGeometry(size * 0.86, size * 0.86);
    const front = new THREE.Mesh(frontGeometry, this.frontMaterial);
    front.position.set(0, 0, FRONT_Z);
    this.group.add(front);
    this.ownGeometries.push(frontGeometry);

    this.pickables = [front, housing];

    // Draw the fallback immediately, so the box is never blank.
    this.draw(null);
  }

  // Swaps the face when the machine changes. Redraws only on a real change.
  update(machine: string): void {
    if (machine === this.machine) return;
    this.machine = machine;

    // Draw the fallback right away so the box never goes blank while the
    // photo is loading, then swap in the real photo once it resolves.
    this.draw(null);

    const token = ++this.token;
    loadAvatar(machineSlug(machine)).then((img) => {
      if (this.disposed || token !== this.token) return;
      this.draw(img);
    });
  }

  // 0 = dark (idle), 1 = fully lit (busy). Called every frame.
  setGlow(intensity: number): void {
    this.frontMaterial.emissiveIntensity = 0.15 + intensity * 1.3;
  }

  dispose(): void {
    this.disposed = true;
    this.token++; // guard against a late onload
    this.texture.dispose();
    this.frontMaterial.dispose();
    this.rimMaterial.dispose();
    for (const geometry of this.ownGeometries) geometry.dispose();
    // MATERIALS.darkSteel is shared scene-wide and is never disposed here.
  }

  private draw(image: HTMLImageElement | null): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#1b1f26";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawAvatarCircle(ctx, image, 256, 256, 200, `#${this.accent.getHexString()}`, initialsFor(this.machine ?? ""));
    this.texture.needsUpdate = true;
  }
}
