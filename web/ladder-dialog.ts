// The milestone overview: one block per user with the whole ladder, so you can
// see what a yard earned and what is still to go. Read only, nothing is bought.
// The total itself is a machine's, but the park names sessions by user, so the
// dialog does too.

import { MILESTONE_ICONS } from "./milestone-icons.ts";
import { ladderRows } from "./milestone-ladder.ts";
import { shortTokens } from "./sign-text.ts";

export type UserTotal = { user: string; tokens: number };

export function createLadderDialog(button: HTMLElement, dialog: HTMLDialogElement, body: HTMLElement) {
  // A park without sessions still shows the ladder, fully locked.
  let totals: UserTotal[] = [];
  let rendered = "";

  function render() {
    const blocks = totals.length ? totals : [{ user: "", tokens: 0 }];
    const key = blocks.map((b) => `${b.user}:${b.tokens}`).join("\n");
    if (key === rendered) return;
    rendered = key;
    // A name above one lonely block says nothing: it is the only total there is.
    body.replaceChildren(...blocks.map((entry) => block(entry, blocks.length > 1)));
  }

  button.addEventListener("click", () => {
    render();
    dialog.showModal();
  });

  return {
    setTotals(next: UserTotal[]) {
      totals = next;
      if (dialog.open) render();
    },
  };
}

function block({ user, tokens }: UserTotal, named: boolean) {
  const element = document.createElement("section");
  element.className = "block";
  element.append(
    div("head", [...(named ? [div("user", user)] : []), div("total", `${shortTokens(tokens)} tokens`)]),
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
