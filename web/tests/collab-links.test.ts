import type * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { SessionState } from "../../server/types.ts";
import { CollabLinks, collabLinks } from "../collab-links.ts";

function session(
  id: string,
  user: string,
  project: string,
  startedAt = 1,
  status: "busy" | "idle" = "idle",
): SessionState {
  return { id, user, project, model: "", status, subagents: 0, startedAt };
}

describe("collabLinks", () => {
  it("makes no link for a single user", () => {
    expect(collabLinks([session("a", "ann", "p"), session("b", "ann", "p")])).toEqual([]);
    expect(collabLinks([session("a", "ann", "p")])).toEqual([]);
  });

  it("links the oldest sessions of two users", () => {
    const links = collabLinks([
      session("a2", "ann", "p", 20),
      session("a1", "ann", "p", 10),
      session("b1", "bob", "p", 30),
      session("b0", "bob", "p", 5),
    ]);
    expect(links).toEqual([{ project: "p", from: "a1", to: "b0" }]);
  });

  it("chains three users sorted by name", () => {
    const links = collabLinks([session("c", "cy", "p"), session("a", "ann", "p"), session("b", "bob", "p")]);
    expect(links).toEqual([
      { project: "p", from: "a", to: "b" },
      { project: "p", from: "b", to: "c" },
    ]);
  });

  it("caps the total at maxLinks, projects in name order", () => {
    const sessions = ["z", "y", "x"].flatMap((p) => [session(`${p}1`, "ann", p), session(`${p}2`, "bob", p)]);
    const links = collabLinks(sessions, 2);
    expect(links.map((l) => l.project)).toEqual(["x", "y"]);
    expect(collabLinks(sessions)).toHaveLength(3);
  });

  it("does not count two sessions of the same user", () => {
    expect(collabLinks([session("a", "ann", "p", 1), session("b", "ann", "p", 2)])).toEqual([]);
  });
});

describe("CollabLinks", () => {
  it("skips a link whose endpoint has no position", () => {
    const links = new CollabLinks();
    const sessions = [session("a", "ann", "p"), session("b", "bob", "p"), session("c", "cy", "p")];
    const pipes = () => links.group.children.find((c) => c.name === "collab-pipes") as THREE.InstancedMesh;
    const at = (id: string) => ({ x: id.charCodeAt(0) * 10, z: 0 });

    links.update(sessions, at);
    expect(pipes().count).toBe(2);
    expect(links.group.visible).toBe(true);

    links.update(sessions, (id) => (id === "c" ? null : at(id)));
    expect(pipes().count).toBe(1);

    links.update(sessions, () => null);
    expect(pipes().count).toBe(0);
    expect(links.group.visible).toBe(false);
    links.dispose();
  });
});
