import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { MEADOW_EDGE } from "../park.ts";
import { fitZoom, parkBounds, parkHalfExtent, zoomFloor } from "../park-layout.ts";
import { PLOT_SIZE } from "../plots.ts";
import { AZIMUTH, CAMERA_DISTANCE, ELEVATION, VIEW_HEIGHT } from "../scene.ts";

// The camera scene.ts builds, looking at `target` from CAMERA_DISTANCE.
function cameraAt(aspect: number, zoom: number, target: THREE.Vector3): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(
    (-VIEW_HEIGHT * aspect) / 2,
    (VIEW_HEIGHT * aspect) / 2,
    VIEW_HEIGHT / 2,
    -VIEW_HEIGHT / 2,
    1,
    CAMERA_DISTANCE * 2,
  );
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  const direction = new THREE.Vector3(
    Math.cos(ELEVATION) * Math.sin(AZIMUTH),
    Math.sin(ELEVATION),
    Math.cos(ELEVATION) * Math.cos(AZIMUTH),
  );
  camera.position.copy(target).addScaledVector(direction, CAMERA_DISTANCE);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}

// Where the four screen corners meet the ground, with their depth in front of
// the camera.
function groundCorners(camera: THREE.OrthographicCamera): { point: THREE.Vector3; depth: number }[] {
  const forward = camera.getWorldDirection(new THREE.Vector3());
  return [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([x, y]) => {
    const point = new THREE.Vector3(x, y, -1).unproject(camera);
    point.addScaledVector(forward, -point.y / forward.y);
    return { point, depth: point.clone().sub(camera.position).dot(forward) };
  });
}

// Zoomed as far out as scene.ts allows over a 300 lot park, with the orbit
// target pushed to each corner of the area it is clamped to, every screen
// corner has to land on the grass plane and in front of the near plane, or
// the sky shows through.
describe("the meadow at the widest zoom", () => {
  const bounds = parkBounds(
    Array.from({ length: 300 }, (_, i) => i),
    true,
  );
  const half = parkHalfExtent(bounds, PLOT_SIZE);
  const center = {
    x: ((bounds.minCol + bounds.maxCol) / 2) * PLOT_SIZE,
    z: ((bounds.minRow + bounds.maxRow) / 2) * PLOT_SIZE,
  };
  const targets = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => new THREE.Vector3(center.x + sx * half, 0, center.z + sz * half)),
  );

  for (const aspect of [0.6, 16 / 9]) {
    it(`covers the screen at aspect ${aspect.toFixed(2)}`, () => {
      const zoom = zoomFloor(fitZoom(half, VIEW_HEIGHT, VIEW_HEIGHT * aspect));
      for (const target of targets) {
        const camera = cameraAt(aspect, zoom, target);
        for (const { point, depth } of groundCorners(camera)) {
          expect(Math.abs(point.x)).toBeLessThan(MEADOW_EDGE);
          expect(Math.abs(point.z)).toBeLessThan(MEADOW_EDGE);
          expect(depth).toBeGreaterThan(camera.near);
        }
      }
    });
  }
});
