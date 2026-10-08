import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Ceremony, type LocateHq, type Particle, SHOWS, particleAt } from "../ceremony.ts";

const tint = new THREE.Color("#3a9bd9");
const locate: LocateHq = (user) => (user === "ghost" ? null : { x: user.length * 10, z: 5, top: 30, tint });
const visibleShows = (c: Ceremony) => c.group.children.filter((child) => child.visible);

describe("Ceremony", () => {
  it("starts a visible show for a milestone", () => {
    const c = new Ceremony(locate);
    c.push({ kind: "milestone", user: "ann", row: 1 });
    expect(c.group.visible).toBe(true);
    expect(visibleShows(c)).toHaveLength(1);
  });

  it("is invisible again once the show is over", () => {
    const c = new Ceremony(locate);
    c.push({ kind: "milestone", user: "ann", row: 1 });
    c.tick(2);
    expect(c.group.visible).toBe(true);
    c.tick(SHOWS.fireworks.duration - 2 + 0.1);
    expect(c.group.visible).toBe(false);
    expect(visibleShows(c)).toHaveLength(0);
  });

  it("ignores users without a HQ", () => {
    const c = new Ceremony(locate);
    c.push({ kind: "kudos", user: "ghost" });
    expect(c.group.visible).toBe(false);
  });

  it("ignores events that are not a celebration", () => {
    const c = new Ceremony(locate);
    c.push({ kind: "session-start", user: "ann", project: "p", model: "m" });
    expect(c.group.visible).toBe(false);
  });

  it("replaces the oldest show when the pool is full", () => {
    const c = new Ceremony(locate);
    c.push({ kind: "milestone", user: "a", row: 1 });
    c.tick(1);
    c.push({ kind: "milestone", user: "bb", row: 1 });
    c.tick(1);
    c.push({ kind: "milestone", user: "ccc", row: 1 });
    c.tick(1);
    c.push({ kind: "milestone", user: "dddd", row: 1 });
    const xs = visibleShows(c)
      .map((m) => m.position.x)
      .sort((a, b) => a - b);
    expect(xs).toEqual([20, 30, 40]);
  });

  it("ends confetti sooner than fireworks", () => {
    const c = new Ceremony(locate);
    c.push({ kind: "kudos", user: "ann" });
    c.tick(SHOWS.confetti.duration + 0.1);
    expect(c.group.visible).toBe(false);
  });
});

describe("particleAt", () => {
  it("starts a firework at the burst height above the top and later sinks below its peak", () => {
    const p: Particle = { x: 0, y: 0, z: 0, scale: 0 };
    expect(particleAt("fireworks", 0, 0, p)).toBe(true);
    expect(p.y).toBeGreaterThanOrEqual(20);
    expect(p.y).toBeLessThanOrEqual(28);
    expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(10 * Math.SQRT2 + 1e-9);
    let peak = p.y;
    for (let t = 0.05; t < SHOWS.fireworks.life; t += 0.05) {
      particleAt("fireworks", 0, t, p);
      peak = Math.max(peak, p.y);
    }
    particleAt("fireworks", 0, SHOWS.fireworks.life - 0.05, p);
    expect(p.y).toBeLessThan(peak);
  });

  it("keeps particles large enough to see from the overview camera", () => {
    const p: Particle = { x: 0, y: 0, z: 0, scale: 0 };
    particleAt("fireworks", 0, 0.1, p);
    expect(p.scale).toBeGreaterThanOrEqual(1.5);
    particleAt("confetti", 0, SHOWS.confetti.life / 2 + 0.6, p);
    expect(p.scale).toBeGreaterThanOrEqual(1.5);
  });

  it("is dead before its burst and after its life", () => {
    const p: Particle = { x: 0, y: 0, z: 0, scale: 0 };
    expect(particleAt("fireworks", 1, 0, p)).toBe(false);
    expect(particleAt("fireworks", 0, SHOWS.fireworks.life + 0.1, p)).toBe(false);
  });
});
