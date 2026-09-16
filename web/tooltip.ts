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

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    screen = { x: event.clientX, y: event.clientY };
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  });
  canvas.addEventListener("pointerleave", () => (screen = null));

  // Called every frame, so the tooltip follows state changes and camera motion.
  function update() {
    hovered = null;
    if (screen) {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables(), false)[0];
      const target = hit?.object.userData.hover as Hoverable | undefined;
      if (target && !target.gone) hovered = target;
    }

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
