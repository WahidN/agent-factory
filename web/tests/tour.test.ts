import { describe, expect, it } from "vitest";
import type { CityEvent } from "../city-feed.ts";
import { Tour, type TourTarget } from "../tour.ts";

const kudos = (user: string): CityEvent => ({ kind: "kudos", user });

function setup(lots: TourTarget[] = []) {
  const pans: TourTarget[] = [];
  const places: Record<string, TourTarget | null> = {};
  const tour = new Tour(
    (x, z) => pans.push({ x, z }),
    (event) => (event.kind === "kudos" ? (places[event.user] ?? null) : null),
    () => lots,
  );
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * 10; i++) tour.tick(0.1);
  };
  return { tour, pans, places, run };
}

describe("Tour", () => {
  it("pans straight to an event with a location", () => {
    const { tour, pans, places } = setup();
    places.ann = { x: 3, z: 4 };
    tour.push(kudos("ann"));
    tour.tick(0.1);
    expect(pans).toEqual([{ x: 3, z: 4 }]);
  });

  it("moves to the next busy lot after the 8 s event hold", () => {
    const { tour, pans, places, run } = setup([{ x: 9, z: 9 }]);
    places.ann = { x: 3, z: 4 };
    tour.push(kudos("ann"));
    run(7.5);
    expect(pans).toEqual([{ x: 3, z: 4 }]);
    run(1);
    expect(pans).toEqual([
      { x: 3, z: 4 },
      { x: 9, z: 9 },
    ]);
  });

  it("cycles busy lots round-robin, sorted by x then z, every 12 s", () => {
    const { pans, run } = setup([
      { x: 5, z: 1 },
      { x: 1, z: 2 },
      { x: 1, z: 1 },
    ]);
    run(12 * 3 + 1);
    expect(pans).toEqual([
      { x: 1, z: 1 },
      { x: 1, z: 2 },
      { x: 5, z: 1 },
      { x: 1, z: 1 },
    ]);
  });

  it("stays still for 60 s after the user touches the camera, then resumes", () => {
    const { tour, pans, run } = setup([{ x: 1, z: 1 }]);
    tour.pauseForUser();
    run(59);
    expect(pans).toEqual([]);
    run(2);
    expect(pans).toEqual([{ x: 1, z: 1 }]);
  });

  it("skips an event without a location", () => {
    const { tour, pans, run } = setup();
    tour.push(kudos("nobody"));
    run(1);
    expect(pans).toEqual([]);
  });

  it("keeps at most 5 queued events and shows the newest first", () => {
    const { tour, pans, places, run } = setup();
    for (let i = 0; i < 7; i++) {
      places[`u${i}`] = { x: i, z: 0 };
      tour.push(kudos(`u${i}`));
    }
    run(8 * 5 + 1);
    expect(pans.map((p) => p.x)).toEqual([6, 5, 4, 3, 2]);
  });

  it("continues after the last shown lot when the pool is rewritten in place", () => {
    const a = { x: 0, z: 0 };
    const b = { x: 10, z: 0 };
    const c = { x: 20, z: 0 };
    const pool: TourTarget[] = [a, b, c];
    const { pans, run } = setup(pool);
    run(0.1);
    // Lot 0 goes idle: the caller rewrites its pool objects in place.
    a.x = 10;
    b.x = 20;
    pool.length = 2;
    run(12 * 3 + 1);
    expect(pans.map((p) => p.x)).toEqual([0, 10, 20, 10]);
  });

  it("does not search for lots on every idle tick", () => {
    let calls = 0;
    const tour = new Tour(
      () => {},
      () => null,
      () => {
        calls++;
        return [];
      },
    );
    for (let i = 0; i < 50; i++) tour.tick(0.1);
    expect(calls).toBeLessThanOrEqual(6);
  });

  it("still reacts to an event while idle", () => {
    const { tour, pans, places } = setup();
    places.ann = { x: 7, z: 7 };
    tour.tick(0.1);
    tour.push(kudos("ann"));
    tour.tick(0.1);
    expect(pans).toEqual([{ x: 7, z: 7 }]);
  });
});
