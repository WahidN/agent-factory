import { describe, expect, it } from "vitest";
import {
  DEFAULT_DETAIL_CAP,
  detailCapFrom,
  type LotPoint,
  REDISTRIBUTE_DISTANCE,
  selectDetailed,
  shouldRedistribute,
} from "../lod.ts";

// A row of lots on the x axis, 100 apart: lot-0 at x 0, lot-1 at x 100, ...
function row(count: number): LotPoint[] {
  return Array.from({ length: count }, (_, i) => ({ id: `lot-${i}`, x: i * 100, z: 0 }));
}

describe("selectDetailed", () => {
  it("never hands out more than the cap, however big the park gets", () => {
    expect(selectDetailed({ x: 0, z: 0 }, row(150), DEFAULT_DETAIL_CAP)).toHaveLength(DEFAULT_DETAIL_CAP);
    expect(selectDetailed({ x: 0, z: 0 }, row(1000), 20)).toHaveLength(20);
  });

  it("gives every lot detail when the park is smaller than the cap", () => {
    expect(selectDetailed({ x: 0, z: 0 }, row(3), 20)).toEqual(["lot-0", "lot-1", "lot-2"]);
  });

  it("gives nothing away at a cap of zero", () => {
    expect(selectDetailed({ x: 0, z: 0 }, row(10), 0)).toEqual([]);
  });

  it("returns the nearest lots first", () => {
    expect(selectDetailed({ x: 520, z: 0 }, row(10), 3)).toEqual(["lot-5", "lot-6", "lot-4"]);
  });

  it("measures distance in both axes", () => {
    const lots: LotPoint[] = [
      { id: "far-z", x: 0, z: 300 },
      { id: "near", x: 30, z: 40 },
    ];
    expect(selectDetailed({ x: 0, z: 0 }, lots, 1)).toEqual(["near"]);
  });

  it("orders two lots at the same distance by id, so the set never depends on input order", () => {
    const lots: LotPoint[] = [
      { id: "b", x: 100, z: 0 },
      { id: "a", x: -100, z: 0 },
    ];
    expect(selectDetailed({ x: 0, z: 0 }, lots, 1)).toEqual(["a"]);
    expect(selectDetailed({ x: 0, z: 0 }, [...lots].reverse(), 1)).toEqual(["a"]);
  });
});

// Two lots compete for one slot, 30 apart. The camera crossing the midpoint at x 115
// is exactly the case that used to rebuild a whole lot twice a second.
describe("selectDetailed hysteresis", () => {
  const lots: LotPoint[] = [
    { id: "inside", x: 100, z: 0 },
    { id: "outside", x: 130, z: 0 },
  ];

  it("flips on the midpoint when nothing is remembered", () => {
    expect(selectDetailed({ x: 114, z: 0 }, lots, 1)).toEqual(["inside"]);
    expect(selectDetailed({ x: 116, z: 0 }, lots, 1)).toEqual(["outside"]);
  });

  it("holds the incumbent through that same drift", () => {
    const current = new Set(["inside"]);
    expect(selectDetailed({ x: 114, z: 0 }, lots, 1, current)).toEqual(["inside"]);
    expect(selectDetailed({ x: 116, z: 0 }, lots, 1, current)).toEqual(["inside"]);
  });

  it("hands the slot over once the challenger is clearly closer", () => {
    // At x 125 the incumbent is 25 away and the challenger 5: no bonus saves it.
    expect(selectDetailed({ x: 125, z: 0 }, lots, 1, new Set(["inside"]))).toEqual(["outside"]);
  });

  it("does not let a remembered lot hold a slot from across the park", () => {
    const parked: LotPoint[] = [
      { id: "held", x: 1000, z: 0 },
      { id: "close", x: 10, z: 0 },
    ];
    expect(selectDetailed({ x: 0, z: 0 }, parked, 1, new Set(["held"]))).toEqual(["close"]);
  });

  it("settles: feeding its own answer back changes nothing", () => {
    const first = selectDetailed({ x: 250, z: 0 }, row(10), 4);
    const second = selectDetailed({ x: 250, z: 0 }, row(10), 4, new Set(first));
    expect([...second].sort()).toEqual([...first].sort());
  });
});

describe("detailCapFrom", () => {
  it("defaults to 20 detailed lots", () => {
    expect(DEFAULT_DETAIL_CAP).toBe(20);
    expect(detailCapFrom("")).toBe(DEFAULT_DETAIL_CAP);
    expect(detailCapFrom("?stats")).toBe(DEFAULT_DETAIL_CAP);
  });

  it("takes the ceiling from the url", () => {
    expect(detailCapFrom("?detail=40")).toBe(40);
    expect(detailCapFrom("?stats&detail=0")).toBe(0);
  });

  it("ignores anything that is not a whole count", () => {
    for (const search of ["?detail=", "?detail=abc", "?detail=-5", "?detail=2.5"]) {
      expect(detailCapFrom(search)).toBe(DEFAULT_DETAIL_CAP);
    }
  });
});

describe("shouldRedistribute", () => {
  it("stays put for a nudge", () => {
    expect(shouldRedistribute({ x: 0, z: 0 }, { x: 5, z: 5 })).toBe(false);
  });

  it("fires once the camera has crossed the threshold", () => {
    expect(shouldRedistribute({ x: 0, z: 0 }, { x: REDISTRIBUTE_DISTANCE, z: 0 })).toBe(true);
    expect(shouldRedistribute({ x: 0, z: 0 }, { x: 0, z: 100 })).toBe(true);
  });

  it("takes a threshold of its own", () => {
    expect(shouldRedistribute({ x: 0, z: 0 }, { x: 3, z: 0 }, 2)).toBe(true);
    expect(shouldRedistribute({ x: 0, z: 0 }, { x: 3, z: 0 }, 5)).toBe(false);
  });
});
