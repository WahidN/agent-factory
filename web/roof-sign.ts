// Extruded rooftop letters on a steel frame, like a factory's company name.
// The text is the session's model, so a hall says OPUS 5 or HAIKU 4.5. Static:
// the lot rebuilds this when its model changes.

import * as THREE from "three";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MATERIALS, standard } from "./palette.ts";
import { modelLabel } from "./sign-text.ts";
import fontData from "./fonts/helvetiker-bold.typeface.json" with { type: "json" };

// Parsed once; every lot reuses the same glyph outlines.
const FONT = new FontLoader().parse(fontData as unknown as Parameters<FontLoader["parse"]>[0]);

// The alphabet is small and shared by every lot, so a letter's geometry is
// built once and reused, never disposed by an individual sign.
const letterGeometryCache = new Map<string, THREE.BufferGeometry>();
function letterGeometry(char: string): THREE.BufferGeometry | undefined {
  let geometry = letterGeometryCache.get(char);
  if (geometry) return geometry;
  const built = new TextGeometry(char, {
    font: FONT,
    size: NOMINAL,
    depth: DEPTH,
    bevelEnabled: false,
    curveSegments: 4,
  });
  built.computeBoundingBox();
  if (!built.boundingBox) {
    built.dispose(); // a glyph the font does not carry
    return undefined;
  }
  geometry = built;
  letterGeometryCache.set(char, geometry);
  return geometry;
}

const MAX_CHARS = 14; // an unknown model id arrives raw, so cap it
const LETTER_HEIGHT = 3; // the tallest the text may ever be
const NOMINAL = 3; // TextGeometry size before the fit scale
const DEPTH = NOMINAL * 0.18;
const TRACKING = NOMINAL * 0.14; // gap between two separate letters
const SPACE_WIDTH = NOMINAL * 0.18;
const WIDTH_FRACTION = 0.82; // of the hall width

const FRAME_HEIGHT = 1.4; // roof surface to the underside of the letters
const BAR = 0.12; // thickness of every frame member
const OVERHANG = 0.3; // rails run a little past the outer letters
const BAY_WIDTH = 2.2; // target spacing of the posts

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const tmpQuaternion = new THREE.Quaternion();
const tmpPosition = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();

// One frame member, centered on (x, y) in the sign plane and turned by `angle`.
function bar(parts: THREE.BufferGeometry[], x: number, y: number, length: number, angle: number) {
  tmpQuaternion.setFromAxisAngle(Z_AXIS, angle);
  tmpMatrix.compose(tmpPosition.set(x, y, 0), tmpQuaternion, tmpScale.set(length, BAR, BAR));
  parts.push(unitBox.clone().applyMatrix4(tmpMatrix));
}

export class RoofSign {
  // Add to the lot structure; the caller sets position and rotation. The
  // letters face +z in local space and sit on y = 0 (the roof surface).
  readonly group!: THREE.Group;

  // The frame's merged geometry, owned by this instance and disposed with it.
  // Letter geometries come from the shared cache above and are never disposed
  // per lot.
  private ownGeometries: THREE.BufferGeometry[] = [];
  private letterMaterial: THREE.MeshStandardMaterial | null = null;

  // `model` is a raw model id ("claude-opus-5"); an empty or unknown one gives
  // an empty group. `maxWidth` is the hall width the letters must fit inside.
  constructor(model: string, maxWidth: number) {
    this.group = new THREE.Group();
    const text = modelLabel(model).toUpperCase().slice(0, MAX_CHARS).trim();

    // A geometry per character, not one for the whole string: separate letters
    // read as bolted-on signage and can be spaced by hand. A space only moves
    // the cursor.
    const placed: { geometry: THREE.BufferGeometry; left: number }[] = [];
    let cursor = 0;
    let width = 0;
    let low = Infinity;
    let high = -Infinity;
    for (const char of text) {
      if (char === " ") {
        cursor += SPACE_WIDTH + TRACKING;
        continue;
      }
      const geometry = letterGeometry(char);
      const box = geometry?.boundingBox;
      if (!geometry || !box) continue; // a glyph the font does not carry
      placed.push({ geometry, left: cursor - box.min.x }); // drop the side bearing
      cursor += box.max.x - box.min.x + TRACKING;
      width = cursor - TRACKING; // right edge of the last letter placed
      low = Math.min(low, box.min.y);
      high = Math.max(high, box.max.y);
    }
    if (placed.length === 0) return;

    // Shrink the whole word at once, never enlarge it.
    const scale = Math.min(1, LETTER_HEIGHT / (high - low), (maxWidth * WIDTH_FRACTION) / width);

    this.letterMaterial = standard("#c9a227", { metalness: 0.85, roughness: 0.35 }); // brushed brass
    const baseline = FRAME_HEIGHT - low * scale;
    for (const { geometry, left } of placed) {
      const mesh = new THREE.Mesh(geometry, this.letterMaterial);
      mesh.position.set((left - width / 2) * scale, baseline, (-DEPTH / 2) * scale); // extrusion straddles z = 0
      mesh.scale.setScalar(scale);
      mesh.castShadow = true;
      // The geometry belongs to the cache above, shared with every other lot
      // showing this letter. Lot.disposeStructure() walks the whole structure
      // and disposes what it finds, so it has to be told to leave this one be.
      mesh.userData.sharedGeometry = true;
      this.group.add(mesh);
    }

    // Open scaffold under the letters: a rail at the foot, a rail carrying the
    // letters, posts every couple of units and an X brace per bay. It merges
    // into one mesh, because this runs for every lot in the park.
    const half = (width * scale) / 2 + OVERHANG;
    const bottom = BAR / 2;
    const top = FRAME_HEIGHT - BAR / 2;
    const parts: THREE.BufferGeometry[] = [];
    bar(parts, 0, bottom, half * 2, 0);
    bar(parts, 0, top, half * 2, 0);

    const bays = Math.max(1, Math.round((half * 2) / BAY_WIDTH));
    const step = (half * 2) / bays;
    for (let i = 0; i <= bays; i++) bar(parts, -half + i * step, FRAME_HEIGHT / 2, FRAME_HEIGHT, Math.PI / 2);

    const diagonal = Math.hypot(step, top - bottom);
    const angle = Math.atan2(top - bottom, step);
    for (let i = 0; i < bays; i++) {
      const center = -half + (i + 0.5) * step;
      bar(parts, center, FRAME_HEIGHT / 2, diagonal, angle);
      bar(parts, center, FRAME_HEIGHT / 2, diagonal, -angle);
    }

    const merged = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    const frame = new THREE.Mesh(merged, MATERIALS.darkSteel);
    frame.castShadow = true;
    this.group.add(frame);
    this.ownGeometries.push(merged);
  }

  dispose(): void {
    for (const geometry of this.ownGeometries) geometry.dispose();
    this.ownGeometries.length = 0;
    this.letterMaterial?.dispose();
    this.letterMaterial = null;
    // MATERIALS.darkSteel is shared scene-wide and is never disposed here.
  }
}
