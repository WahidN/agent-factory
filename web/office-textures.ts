// Photo textures for the office, from web/public/textures (CC0, see the README
// there). StaticBuilder gives textured boxes UVs in metres, so a tile covers
// `tile` metres. They load when the page loads, long before you walk in.

import * as THREE from "three";

const loader = new THREE.TextureLoader();

function photo(file: string, tile: number, color = true) {
  const texture = loader.load(`/textures/${file}`);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / tile, 1 / tile);
  texture.anisotropy = 8;
  return texture;
}

export const mossTexture = photo("moss.jpg", 1.2);
export const mossNormal = photo("moss-normal.jpg", 1.2, false);
export const oakTexture = photo("oak.jpg", 2);
export const carpetTexture = photo("carpet.jpg", 1.5);
export const ceilingTexture = photo("ceiling.jpg", 2);
