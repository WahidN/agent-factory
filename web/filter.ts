// Filtering by user, project and status, plus "jump to me". The matching
// logic is pure (no Three.js, no DOM) so it is easy to test; the panel below
// is a thin, untested DOM shell around it.

import type { SessionState } from "../server/types.ts";

export type Filter = {
  user: string | null;
  project: string | null;
  status: SessionState["status"] | null;
};

export const EMPTY_FILTER: Filter = { user: null, project: null, status: null };

// A `null` field matches anything, so the empty filter matches every session.
export function matchesFilter(session: Pick<SessionState, "user" | "project" | "status">, filter: Filter): boolean {
  if (filter.user !== null && session.user !== filter.user) return false;
  if (filter.project !== null && session.project !== filter.project) return false;
  if (filter.status !== null && session.status !== filter.status) return false;
  return true;
}

// Distinct users and projects across the current sessions, sorted for a
// stable dropdown order.
export function optionsFrom(sessions: readonly Pick<SessionState, "user" | "project">[]): {
  users: string[];
  projects: string[];
} {
  return {
    users: [...new Set(sessions.map((s) => s.user))].sort(),
    projects: [...new Set(sessions.map((s) => s.project))].sort(),
  };
}

// Drops a user or project the current sessions no longer offer. Without this a
// filter can outlive the sessions it named: the dropdown falls back to "all"
// while the filter still hides everything. Returns the same object when there
// is nothing to drop, so the caller can skip the work.
export function pruneFilter(filter: Filter, users: readonly string[], projects: readonly string[]): Filter {
  const user = filter.user !== null && !users.includes(filter.user) ? null : filter.user;
  const project = filter.project !== null && !projects.includes(filter.project) ? null : filter.project;
  if (user === filter.user && project === filter.project) return filter;
  return { ...filter, user, project };
}

// Where "jump to me" points the camera: the average position of every lot
// belonging to that user. Null if that user currently has no lots.
export function jumpTarget(
  user: string,
  lots: readonly { user: string; x: number; z: number }[],
): { x: number; z: number } | null {
  const mine = lots.filter((lot) => lot.user === user);
  if (mine.length === 0) return null;
  const x = mine.reduce((sum, lot) => sum + lot.x, 0) / mine.length;
  const z = mine.reduce((sum, lot) => sum + lot.z, 0) / mine.length;
  return { x, z };
}

export type FilterPanel = {
  setOptions(users: string[], projects: string[]): void;
};

// A small fixed panel, appended to the body. No framework, no router: three
// dropdowns and a jump box. It starts closed behind a button, so the park is
// the first thing you see. A hub never builds one at all, see main.ts.
export function createFilterPanel(onChange: (filter: Filter) => void, onJump: (user: string) => void): FilterPanel {
  const root = document.createElement("div");
  root.className = "filter-panel";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Filter agents in de stad");
  root.hidden = true;

  // `[hidden]` is `display: none !important` in style.css, which is what makes
  // this win from the skin rules that set the panel to `display: flex`.
  const toggle = document.createElement("button");
  toggle.className = "filter-toggle";
  toggle.textContent = "filters";
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    root.hidden = !root.hidden;
    toggle.setAttribute("aria-expanded", String(!root.hidden));
  });

  const title = document.createElement("div");
  title.className = "filter-panel__title";
  title.textContent = "Agent radar";

  const userSelect = document.createElement("select");
  userSelect.setAttribute("aria-label", "Filter op gebruiker");
  const projectSelect = document.createElement("select");
  projectSelect.setAttribute("aria-label", "Filter op project");
  const statusSelect = document.createElement("select");
  statusSelect.setAttribute("aria-label", "Filter op status");
  statusSelect.append(new Option("alle statussen", ""), new Option("busy", "busy"), new Option("idle", "idle"));

  function fillSelect(select: HTMLSelectElement, values: string[], allLabel: string) {
    const previous = select.value;
    select.replaceChildren(new Option(allLabel, ""), ...values.map((v) => new Option(v, v)));
    if (values.includes(previous)) select.value = previous;
  }
  fillSelect(userSelect, [], "alle gebruikers");
  fillSelect(projectSelect, [], "alle projecten");

  function emitChange() {
    onChange({
      user: userSelect.value || null,
      project: projectSelect.value || null,
      status: (statusSelect.value || null) as Filter["status"],
    });
  }
  userSelect.addEventListener("change", emitChange);
  projectSelect.addEventListener("change", emitChange);
  statusSelect.addEventListener("change", emitChange);

  const jumpInput = document.createElement("input");
  jumpInput.placeholder = "jouw username";
  jumpInput.setAttribute("aria-label", "Jouw gebruikersnaam");
  const jumpButton = document.createElement("button");
  jumpButton.textContent = "spring naar mij";
  jumpButton.addEventListener("click", () => {
    const user = jumpInput.value.trim();
    if (user) onJump(user);
  });

  const filters = document.createElement("div");
  filters.className = "filter-panel__filters";
  filters.append(
    labelledControl("Gebruiker", userSelect),
    labelledControl("Project", projectSelect),
    labelledControl("Status", statusSelect),
  );

  const jump = document.createElement("div");
  jump.className = "filter-panel__jump";
  jump.append(labelledControl("Vind je district", jumpInput), jumpButton);

  root.append(title, filters, jump);
  document.body.append(toggle, root);

  return {
    setOptions(users, projects) {
      fillSelect(userSelect, users, "alle gebruikers");
      fillSelect(projectSelect, projects, "alle projecten");
    },
  };
}

function labelledControl(label: string, control: HTMLElement) {
  const field = document.createElement("label");
  field.className = "filter-panel__field";
  const text = document.createElement("span");
  text.textContent = label;
  field.append(text, control);
  return field;
}
