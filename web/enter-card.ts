// The card that offers the way into your own head office. It is the only
// thing in the city that a click opens, so it lives next to the ladder dialog
// rather than inside main.ts.

import type { HqHover } from "./tooltip.ts";

export type EnterCard = {
  open(hq: HqHover): void;
  close(): void;
  readonly isOpen: boolean;
};

export function createEnterCard(root: HTMLElement, onEnter: () => void): EnterCard {
  const name = div("enter-card__name");
  const line = div("enter-card__line");
  line.textContent = "hoofdkantoor";
  const agents = div("enter-card__agents");

  const go = document.createElement("button");
  go.type = "button";
  go.className = "enter-card__go";
  go.textContent = "naar binnen";
  go.addEventListener("click", () => {
    card.close();
    onEnter();
  });

  const shut = document.createElement("button");
  shut.type = "button";
  shut.className = "enter-card__close";
  shut.setAttribute("aria-label", "sluiten");
  shut.textContent = "×";
  shut.addEventListener("click", () => card.close());

  root.append(shut, name, line, agents, go);

  // A press anywhere else puts the card away, including one that goes on to
  // rotate the camera. A press on the card itself is the card's own.
  document.addEventListener("pointerdown", (event) => {
    if (!root.hidden && !root.contains(event.target as Node)) card.close();
  });

  const card: EnterCard = {
    open(hq) {
      name.textContent = hq.user;
      agents.textContent = `${hq.agents} ${hq.agents === 1 ? "agent" : "agents"} binnen`;
      root.hidden = false;
    },
    close() {
      root.hidden = true;
    },
    get isOpen() {
      return !root.hidden;
    },
  };
  return card;
}

function div(className: string) {
  const element = document.createElement("div");
  element.className = className;
  return element;
}
