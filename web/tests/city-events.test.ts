import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CityEvents, type CityClaim } from "../city-events.ts";

const claims: CityClaim[] = [
  { cell: { col: 0, row: 0 }, amenity: "goffert" },
  { cell: { col: 2, row: 0 }, amenity: "plein1944" },
  { cell: { col: 3, row: 1 }, amenity: "valkhof" },
];

const bounds = { minCol: 0, maxCol: 3, minRow: 0, maxRow: 1 };

function matrices(events: CityEvents) {
  const matrix = new THREE.Matrix4();
  return events.group.children.flatMap((child) => {
    const mesh = child as THREE.InstancedMesh;
    return Array.from({ length: mesh.count }, (_, index) => {
      mesh.getMatrixAt(index, matrix);
      return matrix.elements.map((value) => Number(value.toFixed(5)));
    });
  });
}

describe("CityEvents", () => {
  it("places a mode deterministically, independent of claim order", () => {
    const a = new CityEvents();
    const b = new CityEvents();
    const activity = { hour: 14, busyRatio: 0.72, event: "vierdaagse" as const };
    a.setCity(claims, bounds, activity);
    b.setCity([...claims].reverse(), bounds, activity);
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(matrices(a)).toEqual(matrices(b));
  });

  it("switches between recognisable Nijmegen event sets", () => {
    const events = new CityEvents();
    events.setCity(claims, bounds, { hour: 14, busyRatio: 0.8, event: "vierdaagse" });
    expect(events.snapshot()).toMatchObject({ mode: "vierdaagse" });
    expect(events.snapshot().flowers).toBeGreaterThan(0);
    expect(events.snapshot().flags).toBeGreaterThan(0);

    events.setMode("nec-matchday");
    expect(events.snapshot()).toMatchObject({ mode: "nec-matchday", flowers: 0, stalls: 0 });
    expect(events.snapshot().people).toBeGreaterThan(0);

    events.setMode("market-day");
    expect(events.snapshot()).toMatchObject({ mode: "market-day", flowers: 0, flags: 0 });
    expect(events.snapshot().stalls).toBeGreaterThan(0);

    events.setMode("ordinary");
    expect(events.snapshot()).toMatchObject({ mode: "ordinary", people: 0, flags: 0, flowers: 0, stalls: 0 });
  });

  it("keeps meshes, draw calls and instances bounded when activity changes", () => {
    const events = new CityEvents();
    const children = [...events.group.children];
    events.setCity(claims, bounds, { hour: 16, busyRatio: 10, event: "vierdaagse" });
    expect(events.group.children).toEqual(children);
    expect(events.snapshot().drawCalls).toBeLessThanOrEqual(7);
    expect(events.snapshot().people).toBeLessThanOrEqual(48);
    expect(events.snapshot().instances).toBeLessThanOrEqual(48 * 2 + 12 * 2 + 36 + 10 * 2);

    events.setActivity({ hour: 3, busyRatio: 1, event: "vierdaagse" });
    expect(events.group.children).toEqual(children);
    expect(events.snapshot().instances).toBeGreaterThan(0);
  });
});
