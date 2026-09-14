import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

export type FrameCallback = (dtSeconds: number, nowMs: number) => void;

const VIEW_HEIGHT = 120; // world units visible top to bottom at zoom 1
const CAMERA_DISTANCE = 600;
const AZIMUTH = Math.PI / 4;
const ELEVATION = Math.atan(1 / Math.SQRT2); // about 35°, the classic isometric angle

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#14181f");

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
  controls.enablePan = false;
  controls.minZoom = 0.3;
  controls.maxZoom = 4;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI * 0.42; // stays above the ground

  scene.add(new THREE.HemisphereLight("#e6f2ff", "#6d8f58", 1.3));
  const sun = new THREE.DirectionalLight("#fff3e0", 2.6);
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
  composer.addPass(new OutputPass());

  // HTML labels on top of the canvas. Kept out of the 3D passes, so ambient
  // occlusion does not draw them as dark boxes.
  const labels = new CSS2DRenderer();
  Object.assign(labels.domElement.style, { position: "fixed", inset: "0", pointerEvents: "none" });
  canvas.after(labels.domElement);

  const focusTarget = new THREE.Vector3();

  // Moves the orbit center to the town and sizes the sun's shadow area to it.
  // With `fit`, also zooms so the whole town is in view.
  function focus(x: number, z: number, halfExtent: number, fit = false) {
    focusTarget.set(x, 0, z);
    const size = halfExtent + 30;
    Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size });
    sun.shadow.camera.updateProjectionMatrix();
    if (fit) {
      // A square town seen isometrically is about 1.9 half extents tall and 3 wide on screen.
      const byHeight = VIEW_HEIGHT / (halfExtent * 1.9);
      const byWidth = (camera.right - camera.left) / (halfExtent * 3);
      camera.zoom = THREE.MathUtils.clamp(Math.min(byHeight, byWidth), controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix();
    }
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    labels.setSize(width, height);
    const aspect = width / height;
    Object.assign(camera, {
      left: (-VIEW_HEIGHT * aspect) / 2,
      right: (VIEW_HEIGHT * aspect) / 2,
      top: VIEW_HEIGHT / 2,
      bottom: -VIEW_HEIGHT / 2,
    });
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  const callbacks = new Set<FrameCallback>();
  const timer = new THREE.Timer();
  timer.connect(document); // avoids a huge delta after the tab was hidden
  const move = new THREE.Vector3();
  renderer.setAnimationLoop((timestamp) => {
    timer.update(timestamp);
    const dt = Math.min(timer.getDelta(), 0.1);
    const now = performance.now();

    move.copy(focusTarget).sub(controls.target).multiplyScalar(Math.min(1, dt * 3));
    controls.target.add(move);
    camera.position.add(move);
    controls.update();

    sun.target.position.copy(controls.target);
    sun.position.copy(controls.target).add(sunOffset);

    for (const callback of callbacks) callback(dt, now);
    composer.render(dt);
    labels.render(scene, camera);
  });

  return {
    scene,
    camera,
    focus,
    onFrame: (callback: FrameCallback) => callbacks.add(callback),
  };
}
