import * as THREE from "three";
import type { SessionState } from "../server/types.ts";
import { shortTokens } from "./sign-text.ts";

// What an HQ shows: it has no session of its own, so it hands over a summary
// of the user it belongs to.
export type HqHover = { user: string; agents: number; tokens: number };

// Anything hoverable puts itself in `mesh.userData.hover`. A lot hands over
// the session it draws; an HQ hands over the summary above.
type Hoverable = { gone: boolean } & ({ state: SessionState } | { hq: HqHover });

// Shows details for the hall or warehouse under the pointer.
export function createTooltip(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  element: HTMLElement,
  pickables: () => THREE.Object3D[],
  onCameraChange: (callback: () => void) => void,
) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let screen: { x: number; y: number } | null = null;
  let hovered: Hoverable | null = null;
  let rendered = "";
  let lastPickables: THREE.Object3D[] | null = null;
  // The pointer moving, the camera moving (the world under a still pointer
  // changes too), and the pickable set itself changing (a promoted, demoted
  // or filtered-out lot) all make the raycast worth rerunning; re-testing
  // hundreds of meshes on every frame regardless would not. A still-hovered
  // lot's text can still change every frame below, since that just rereads
  // its already-known state.
  let dirty = true;

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    screen = { x: event.clientX, y: event.clientY };
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    dirty = true;
  });
  // A click is a press and release that hardly moved: OrbitControls rotates on
  // a left drag, and a rotation must not count. The raycast runs on the
  // release point itself, since a tap on touch has no pointermove before it.
  let pickHandler: ((hover: HqHover) => void) | null = null;
  let pressed: Press | null = null;
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return; // a right click is no kudos
    pressed = { x: event.clientX, y: event.clientY, t: event.timeStamp };
  });
  canvas.addEventListener("pointerup", (event) => {
    const down = pressed;
    pressed = null;
    if (!pickHandler || !down || !isClick(down, { x: event.clientX, y: event.clientY, t: event.timeStamp })) return;
    const rect = canvas.getBoundingClientRect();
    const at = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(at, camera);
    const target = raycaster.intersectObjects(pickables(), false)[0]?.object.userData.hover as Hoverable | undefined;
    if (target && !target.gone && "hq" in target) pickHandler(target.hq);
  });
  canvas.addEventListener("pointerleave", () => {
    screen = null;
    dirty = true;
  });
  onCameraChange(() => {
    dirty = true;
  });

  // Called every frame, so the tooltip's text still follows state changes;
  // the raycast itself only reruns when something that could change its
  // result actually did.
  function update() {
    const current = pickables();
    if (current !== lastPickables) {
      lastPickables = current;
      dirty = true;
    }
    if (dirty) {
      dirty = false;
      hovered = null;
      if (screen) {
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(current, false)[0];
        const target = hit?.object.userData.hover as Hoverable | undefined;
        if (target && !target.gone) hovered = target;
      }
    }

    if (hovered?.gone) hovered = null; // the lot left without the pointer moving
    element.hidden = !hovered;
    if (!hovered || !screen) return;

    // Lines are text until they change: update runs every frame the pointer
    // is on something, and building the divs to compare them throws away four
    // or five DOM nodes a frame.
    const lines = "hq" in hovered ? hqLines(hovered.hq) : sessionLines(hovered.state);
    const key = lines.map(([, text]) => text).join("\n");
    if (key !== rendered) {
      rendered = key;
      element.replaceChildren(...lines.map(([className, text]) => line(className, text)));
    }

    const x = Math.min(screen.x + 16, window.innerWidth - element.offsetWidth - 8);
    const y = Math.min(screen.y + 16, window.innerHeight - element.offsetHeight - 8);
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  }

  return {
    update,
    // One handler; fires for a click on a head office only.
    onPick(handler: (hover: HqHover) => void) {
      pickHandler = handler;
    },
  };
}

type Press = { x: number; y: number; t: number };

const CLICK_MAX_PX = 5;
const CLICK_MAX_MS = 500;

// Whether a press and release together are a click and not a drag or a hold.
export function isClick(down: Press, up: Press): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) < CLICK_MAX_PX && up.t - down.t < CLICK_MAX_MS;
}

type Line = [className: string, text: string];

function sessionLines({ user, project, status, model, machineTokens }: SessionState): Line[] {
  const lines: Line[] = [
    ["name", user],
    [status, status],
    ["project", project],
  ];
  if (model) lines.push(["model", model]); // no line until the transcript names a model
  // A machine still on protocol 2 sends no total, and then shows no token line.
  if (machineTokens !== undefined) lines.push(["tokens", `${shortTokens(machineTokens)} tokens`]);
  return lines;
}

function hqLines({ user, agents, tokens }: HqHover): Line[] {
  return [
    ["name", user],
    ["hq", "head office"],
    ["agents", `${agents} ${agents === 1 ? "agent" : "agents"}`],
    ["tokens", `${shortTokens(tokens)} tokens`],
  ];
}

function line(className: string, text: string) {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = text;
  return div;
}
