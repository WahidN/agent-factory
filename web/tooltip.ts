import * as THREE from "three";
import type { AgentState } from "../server/types.ts";

// Anything hoverable puts itself in `mesh.userData.hover`.
type Hoverable = { state: AgentState; gone: boolean };

// Shows details for the hall or warehouse under the pointer.
export function createTooltip(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  element: HTMLElement,
  pickables: () => THREE.Object3D[],
) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let screen: { x: number; y: number } | null = null;
  let hovered: Hoverable | null = null;
  let rendered = "";
  // Only the pointer moving can change what is under it; re-raycasting every
  // frame re-tests hundreds of meshes for no reason while the mouse sits
  // still. A still-hovered lot's text can still change every frame below,
  // since that just rereads its already-known state.
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
  canvas.addEventListener("pointerleave", () => {
    screen = null;
    dirty = true;
  });

  // Called every frame, so the tooltip's text still follows state changes and
  // camera motion; the raycast itself only reruns when the pointer moved.
  function update() {
    if (dirty) {
      dirty = false;
      hovered = null;
      if (screen) {
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(pickables(), false)[0];
        const target = hit?.object.userData.hover as Hoverable | undefined;
        if (target && !target.gone) hovered = target;
      }
    }

    if (hovered?.gone) hovered = null; // the lot left without the pointer moving
    element.hidden = !hovered;
    if (!hovered || !screen) return;

    const { user, project, status, model } = hovered.state;
    const key = [user, project, status, model].join("\n");
    if (key !== rendered) {
      rendered = key;
      element.replaceChildren(
        line("name", user),
        line(status, status),
        line("project", project),
        ...(model ? [line("model", model)] : []), // no line until the transcript names a model
      );
    }

    const x = Math.min(screen.x + 16, window.innerWidth - element.offsetWidth - 8);
    const y = Math.min(screen.y + 16, window.innerHeight - element.offsetHeight - 8);
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  }

  return { update };
}

function line(className: string, text: string) {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = text;
  return div;
}
