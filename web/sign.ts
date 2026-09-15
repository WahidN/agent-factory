// A physical yard sign on two posts, standing in front of a lot. Replaces the
// floating HTML label. Text is drawn on a canvas texture shared by front and
// back planes so the board reads correctly from either side.

import * as THREE from "three";
import { drawAvatarCircle, loadAvatar } from "./avatar.ts";
import { MATERIALS, standard } from "./palette.ts";
import { machineSlug, initialsFor, truncate } from "./sign-text.ts";

export type SignData = {
  name: string;
  folder: string;
  machine: string;
  model: string;
  overflow: number;
};

// Board geometry, in local units above the yard ground (the caller places
// the group at yard height).
const BOARD_WIDTH = 16;
const BOARD_HEIGHT = 6;
const BOARD_BOTTOM = 1.8;
const BOARD_TOP = BOARD_BOTTOM + BOARD_HEIGHT;
const BOARD_DEPTH = 0.12;
const STRIPE_HEIGHT = 0.16;
const POST_SIZE = 0.25;
const POST_INSET = 0.6; // distance of each post's center from the board edge

const CANVAS_WIDTH = 2048;
const CANVAS_HEIGHT = 768;

// Only folder, machine (the avatar) and overflow are drawn on the board, so
// a change in name or model alone is not a visible change.
function sameData(a: SignData | null, b: SignData): boolean {
  if (!a) return false;
  return a.folder === b.folder && a.machine === b.machine && a.overflow === b.overflow;
}

export class Sign {
  readonly group: THREE.Group;
  readonly pickables: THREE.Mesh[];

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private textMaterial: THREE.MeshStandardMaterial;
  private boardMaterial!: THREE.MeshStandardMaterial;
  private stripeMaterial!: THREE.MeshStandardMaterial;
  private ownGeometries: THREE.BufferGeometry[] = [];
  private accent: THREE.Color;
  private data: SignData | null = null;
  private avatarImage: HTMLImageElement | null = null;
  private avatarToken = 0; // bumped on dispose so a late onload draws nothing
  private disposed = false;

  constructor(accent: THREE.Color) {
    this.accent = accent;
    this.group = new THREE.Group();

    this.canvas = document.createElement("canvas");
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.ctx = this.canvas.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.textMaterial = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.9, metalness: 0 });

    // Posts, from the ground to the board top. MATERIALS.darkSteel is shared
    // across the scene, so it is never disposed by this class.
    const postGeometry = new THREE.BoxGeometry(POST_SIZE, BOARD_TOP, POST_SIZE);
    const postHalf = BOARD_WIDTH / 2 - POST_INSET;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(postGeometry, MATERIALS.darkSteel);
      post.position.set(sx * postHalf, BOARD_TOP / 2, 0);
      post.castShadow = true;
      post.receiveShadow = true;
      this.group.add(post);
    }
    this.ownGeometries.push(postGeometry);

    // Board backing plate. Own material (not shared), so it is disposed.
    this.boardMaterial = standard("#f0f0ee");
    const boardGeometry = new THREE.BoxGeometry(BOARD_WIDTH, BOARD_HEIGHT, BOARD_DEPTH);
    const board = new THREE.Mesh(boardGeometry, this.boardMaterial);
    board.position.set(0, BOARD_BOTTOM + BOARD_HEIGHT / 2, 0);
    board.castShadow = true;
    board.receiveShadow = true;
    this.group.add(board);
    this.ownGeometries.push(boardGeometry);

    // Accent stripe along the bottom of the board. Own material (accent color).
    this.stripeMaterial = standard(accent);
    const stripeGeometry = new THREE.BoxGeometry(BOARD_WIDTH, STRIPE_HEIGHT, BOARD_DEPTH + 0.01);
    const stripe = new THREE.Mesh(stripeGeometry, this.stripeMaterial);
    stripe.position.set(0, BOARD_BOTTOM + STRIPE_HEIGHT / 2, 0);
    stripe.castShadow = true;
    this.group.add(stripe);
    this.ownGeometries.push(stripeGeometry);

    // Text planes, front and back, same texture read the right way round.
    const textWidth = BOARD_WIDTH - 0.4;
    const textHeight = BOARD_HEIGHT - 0.4;
    const textY = BOARD_BOTTOM + STRIPE_HEIGHT + textHeight / 2;
    const planeGeometry = new THREE.PlaneGeometry(textWidth, textHeight);
    this.ownGeometries.push(planeGeometry);

    const front = new THREE.Mesh(planeGeometry, this.textMaterial);
    front.position.set(0, textY, BOARD_DEPTH / 2 + 0.001);
    front.castShadow = true;
    this.group.add(front);

    const back = new THREE.Mesh(planeGeometry, this.textMaterial);
    back.position.set(0, textY, -BOARD_DEPTH / 2 - 0.001);
    back.rotation.y = Math.PI;
    back.castShadow = true;
    this.group.add(back);

    this.pickables = [front, back];

    // Draw the fallback frame immediately, so the board is never blank while
    // an avatar photo is still loading.
    this.draw();
  }

  update(data: SignData): void {
    if (sameData(this.data, data)) return;
    const machineChanged = this.data?.machine !== data.machine;
    this.data = data;

    if (machineChanged) {
      this.avatarImage = null;
      const token = ++this.avatarToken;
      loadAvatar(machineSlug(data.machine)).then((img) => {
        if (this.disposed || token !== this.avatarToken) return;
        this.avatarImage = img;
        this.draw();
      });
    }

    this.draw();
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const avatarCx = 384;
    const avatarCy = 384;
    const avatarRadius = 280;
    drawAvatarCircle(ctx, this.avatarImage, avatarCx, avatarCy, avatarRadius, `#${this.accent.getHexString()}`, initialsFor(this.data?.machine ?? ""));

    // Just the project name, large and centered in the space beside the avatar.
    const textX = 760;
    const maxWidth = CANVAS_WIDTH - textX - 80;
    const folder = this.data?.folder ?? "";
    ctx.fillStyle = "#2b2f36";
    ctx.textBaseline = "middle";
    // Shrink to fit before cutting: a long folder name reads better small than
    // chopped off. Below 110px it stops shrinking and truncate takes over.
    let size = 220;
    const fit = () => {
      ctx.font = `700 ${size}px system-ui, sans-serif`;
      return ctx.measureText(folder).width;
    };
    while (fit() > maxWidth && size > 110) size -= 10;
    ctx.fillText(truncate(folder, maxWidth, (s) => ctx.measureText(s).width), textX, CANVAS_HEIGHT / 2);
    ctx.textBaseline = "alphabetic";

    if (this.data && this.data.overflow > 0) {
      const label = `+${this.data.overflow}`;
      ctx.font = "700 90px system-ui, sans-serif";
      const pillWidth = ctx.measureText(label).width + 88;
      const pillHeight = 130;
      const pillX = CANVAS_WIDTH - 64 - pillWidth;
      const pillY = 56;
      ctx.fillStyle = "#2b2f36";
      this.roundRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, pillX + 44, pillY + pillHeight / 2 + 4);
      ctx.textBaseline = "alphabetic";
    }

    this.texture.needsUpdate = true;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  dispose(): void {
    this.disposed = true;
    this.avatarToken++; // guard against a late onload
    this.texture.dispose();
    this.textMaterial.dispose();
    this.boardMaterial.dispose();
    this.stripeMaterial.dispose();
    for (const geometry of this.ownGeometries) geometry.dispose();
    // MATERIALS.darkSteel is shared scene-wide and is never disposed here.
  }
}
