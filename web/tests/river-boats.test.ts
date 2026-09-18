import { describe, expect, it } from "vitest";
import { RiverBoats } from "../river-boats.ts";

describe("RiverBoats", () => {
  it("draws nothing until the city reaches the Waal", () => {
    const traffic = new RiverBoats();
    expect(traffic.visibleCount()).toBe(0);
    expect(traffic.group.children.every((child) => "count" in child && child.count === 0)).toBe(true);
  });

  it("scales a bounded number of instances with the visible river", () => {
    const traffic = new RiverBoats();
    traffic.setRiver({ west: -30, east: 330, z: 90, width: 20 });
    expect(traffic.visibleCount()).toBe(4);
    expect(traffic.group.children.every((child) => "count" in child && child.count === 4)).toBe(true);
  });

  it("moves boats without creating more meshes", () => {
    const traffic = new RiverBoats();
    traffic.setRiver({ west: 0, east: 180, z: 90, width: 20 });
    const before = [...traffic.group.children];
    traffic.tick(5);
    expect(traffic.group.children).toEqual(before);
    expect(traffic.visibleCount()).toBe(2);
  });
});
