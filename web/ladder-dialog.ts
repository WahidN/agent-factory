// The milestone overview: one block per machine with the whole ladder, so you
// can see what a yard earned and what is still to go. Read only, nothing is bought.

import { MILESTONE_ICONS } from "./milestone-icons.ts";
import { ladderRows } from "./milestone-ladder.ts";
import { shortTokens } from "./sign-text.ts";

export type MachineTotal = { machine: string; tokens: number };

export function createLadderDialog(button: HTMLElement, dialog: HTMLDialogElement, body: HTMLElement) {
  // A park without sessions still shows the ladder, fully locked.
  let totals: MachineTotal[] = [];
  let rendered = "";

  function render() {
    const blocks = totals.length ? totals : [{ machine: "", tokens: 0 }];
    const key = blocks.map((b) => `${b.machine}:${b.tokens}`).join("\n");
    if (key === rendered) return;
    rendered = key;
    body.replaceChildren(...blocks.map(block));
  }

  button.addEventListener("click", () => {
    render();
    dialog.showModal();
  });

  return {
    setTotals(next: MachineTotal[]) {
      totals = next;
      if (dialog.open) render();
    },
  };
}

function block({ machine, tokens }: MachineTotal) {
  const element = document.createElement("section");
  element.className = "block";
  element.append(
    div("head", [div("machine", machine), div("total", `${shortTokens(tokens)} tokens`)]),
    ...ladderRows(tokens).map((row, i) => {
      const state = row.unlocked ? "unlocked" : `${shortTokens(row.toGo)} to go`;
      return div(row.unlocked ? "row unlocked" : "row locked", [
        icon(i),
        div("threshold", shortTokens(row.tokens)),
        div("label", row.label),
        div("state", state),
      ]);
    }),
  );
  return element;
}

// The icons are constants in this repo, never anything a machine sent.
function icon(index: number) {
  const element = document.createElement("div");
  element.className = "icon";
  element.innerHTML = MILESTONE_ICONS[index];
  return element;
}

function div(className: string, content: string | HTMLElement[]) {
  const element = document.createElement("div");
  element.className = className;
  if (typeof content === "string") element.textContent = content;
  else element.append(...content);
  return element;
}
