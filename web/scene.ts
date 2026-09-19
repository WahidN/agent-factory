import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { INK_OUTLINE_SHADER } from "./ink-outline.ts";
import { INK_STYLE_ENABLED } from "./ink-style.ts";
import { fitZoom, MAX_ZOOM, MIN_ZOOM } from "./park-layout.ts";
import type { ViewOptions } from "./view-options.ts";

export type FrameCallback = (dtSeconds: number, nowMs: number) => void;

const VIEW_HEIGHT = 120; // world units visible top to bottom at zoom 1
const CAMERA_DISTANCE = 600;
const AZIMUTH = Math.PI / 4;
const ELEVATION = Math.atan(1 / Math.SQRT2); // about 35°, the classic isometric angle

export function createScene(canvas: HTMLCanvasElement, options: ViewOptions = { autoFit: false, fitScale: 1 }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // The sun is fixed and buildings do not move, so the shadow map only needs
  // a redraw when the layout changes or the camera settles somewhere new
  // (see the distance check in the render loop below), not every frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  // Clear Dutch daylight keeps the diorama legible while the giant meadow
  // plane below guarantees that every visible piece of terrain is grass.
  const skyColor = INK_STYLE_ENABLED ? "#797fa3" : "#a9ced7";
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(skyColor, 900, 1450);

  // Orthographic: parallel edges stay parallel, like the reference render.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, CAMERA_DISTANCE * 3);
  const viewDirection = new THREE.Vector3(
    Math.cos(ELEVATION) * Math.sin(AZIMUTH),
    Math.sin(ELEVATION),
    Math.cos(ELEVATION) * Math.cos(AZIMUTH),
  );
  camera.position.copy(viewDirection).multiplyScalar(CAMERA_DISTANCE);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  // Panning is what makes the detail set worth redistributing: drag the view
  // to a corner of the park and the nearest lots there get the full treatment.
  // With it off, the detailed set never moved off the park's centre.
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = false;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  // Both live in park-layout.ts, next to the test that pins them against the
  // zoom 150 and 300 lots actually need. The old floor of 0.3 cropped the
  // park from 37 lots onward.
  controls.minZoom = MIN_ZOOM;
  controls.maxZoom = MAX_ZOOM;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI * 0.42; // stays above the ground

  scene.add(
    INK_STYLE_ENABLED
      ? new THREE.HemisphereLight("#e7e7ff", "#35374f", 1.45)
      : new THREE.HemisphereLight("#effaff", "#62794b", 1.55),
  );
  const sun = INK_STYLE_ENABLED
    ? new THREE.DirectionalLight("#ffd9ad", 2.65)
    : new THREE.DirectionalLight("#fff2d1", 2.75);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 3;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.04;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 900;
  scene.add(sun, sun.target);
  const sunOffset = new THREE.Vector3(-160, 260, 120);

  // Ambient occlusion darkens corners and gaps, which gives the soft look.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, 1, 1);
  ao.updateGtaoMaterial({ radius: 3, distanceExponent: 1.5, thickness: 2, scale: 1.2, samples: 16 });
  ao.blendIntensity = 0.85;
  composer.addPass(ao);
  const inkOutline = INK_STYLE_ENABLED ? new ShaderPass(INK_OUTLINE_SHADER) : null;
  if (inkOutline) composer.addPass(inkOutline);
  composer.addPass(new OutputPass());

  const focusTarget = new THREE.Vector3();
  let focusActive = false;
  let focusedHalfExtent: number | null = null;

  // A deliberate drag/rotate/zoom owns the camera from that moment onward.
  // Without this, the old focus loop pulled a manual pan back to the park
  // centre every frame, making the controls feel broken.
  controls.addEventListener("start", () => {
    focusActive = false;
    canvas.style.cursor = "grabbing";
  });
  controls.addEventListener("end", () => {
    canvas.style.cursor = "grab";
  });
  canvas.style.cursor = "grab";
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  // Moves the orbit center to the town and sizes the sun's shadow area to it.
  // With `fit`, also zooms so the whole town is in view.
  function fitCamera(halfExtent: number) {
    const wanted = fitZoom(halfExtent, VIEW_HEIGHT, camera.right - camera.left) * options.fitScale;
    camera.zoom = THREE.MathUtils.clamp(wanted, controls.minZoom, controls.maxZoom);
    camera.updateProjectionMatrix();
  }

  function focus(x: number, z: number, halfExtent: number, fit = false) {
    focusTarget.set(x, 0, z);
    focusActive = true;
    focusedHalfExtent = halfExtent;
    const size = halfExtent + 30;
    Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size });
    sun.shadow.camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true; // layout changed, the map is stale
    if (fit || options.autoFit) fitCamera(halfExtent);
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    ao.setSize(Math.max(1, width / 2), Math.max(1, height / 2)); // half res, still reads fine blended in
    inkOutline?.uniforms.resolution.value.set(Math.max(1, width), Math.max(1, height));
    const aspect = width / height;
    Object.assign(camera, {
      left: (-VIEW_HEIGHT * aspect) / 2,
      right: (VIEW_HEIGHT * aspect) / 2,
      top: VIEW_HEIGHT / 2,
      bottom: -VIEW_HEIGHT / 2,
    });
    camera.updateProjectionMatrix();
    if (options.autoFit && focusedHalfExtent !== null) fitCamera(focusedHalfExtent);
  }
  window.addEventListener("resize", resize);
  resize();

  const callbacks = new Set<FrameCallback>();
  const timer = new THREE.Timer();
  timer.connect(document); // avoids a huge delta after the tab was hidden
  const move = new THREE.Vector3();
  const lastShadowSunPos = sun.position.clone();
  const SHADOW_UPDATE_DISTANCE = 0.5; // world units the sun must drift before a redraw is worth it
  renderer.setAnimationLoop((timestamp) => {
    timer.update(timestamp);
    const dt = Math.min(timer.getDelta(), 0.1);
    const now = performance.now();

    if (focusActive) {
      move
        .copy(focusTarget)
        .sub(controls.target)
        .multiplyScalar(Math.min(1, dt * 3));
      controls.target.add(move);
      camera.position.add(move);
      if (controls.target.distanceToSquared(focusTarget) < 0.0001) focusActive = false;
    }
    controls.update();

    sun.target.position.copy(controls.target);
    sun.position.copy(controls.target).add(sunOffset);
    if (sun.position.distanceTo(lastShadowSunPos) > SHADOW_UPDATE_DISTANCE) {
      renderer.shadowMap.needsUpdate = true;
      lastShadowSunPos.copy(sun.position);
    }

    for (const callback of callbacks) callback(dt, now);
    composer.render(dt);
  });

  // Glides the orbit center to a point without touching the shadow area or
  // the zoom, for a "jump to me" click rather than a layout change.
  function panTo(x: number, z: number) {
    focusTarget.set(x, 0, z);
    focusActive = true;
  }

  return {
    scene,
    camera,
    focus,
    panTo,
    onFrame: (callback: FrameCallback) => callbacks.add(callback),
  };
}
