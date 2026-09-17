import { describe, expect, it } from "vitest";
import {
  amenityAt,
  BRIDGES,
  CLAIMED,
  claimAt,
  claimedUpTo,
  crossingAt,
  FILLER_CYCLE,
  FILLER_EVERY,
  indexForRank,
  isWaterEdge,
  WAAL_EDGE,
} from "../city-plan.ts";
import { curveCell, plotCell } from "../plots.ts";

const key = ({ col, row }: { col: number; row: number }) => `${col}:${row}`;

describe("amenityAt", () => {
  it("reads the table by cell", () => {
    expect(amenityAt({ col: 1, row: 1 })).toBe("stevenskerk");
    expect(amenityAt({ col: 0, row: 0 })).toBe("goffert");
  });

  it("gives null for a cell nobody claimed", () => {
    expect(amenityAt({ col: 40, row: 40 })).toBeNull();
  });
});

describe("indexForRank", () => {
  it("never puts a session on a claimed cell", () => {
    for (let rank = 0; rank < 400; rank++) {
      expect(CLAIMED.has(key(plotCell(rank)))).toBe(false);
    }
  });

  it("never puts a session on a cell the plan took for filler either", () => {
    for (let rank = 0; rank < 400; rank++) {
      expect(claimAt(indexForRank(rank))).toBeNull();
    }
  });

  it("is strictly increasing", () => {
    for (let rank = 1; rank < 400; rank++) {
      expect(indexForRank(rank)).toBeGreaterThan(indexForRank(rank - 1));
    }
  });

  it("skips exactly the claimed indexes and nothing else", () => {
    const last = indexForRank(399);
    const free: number[] = [];
    for (let index = 0; index <= last; index++) if (claimAt(index) === null) free.push(index);
    expect(free.slice(0, 400)).toEqual(Array.from({ length: 400 }, (_, rank) => indexForRank(rank)));
  });

  it("gives the same answer however often it is asked, in any order", () => {
    const forward = Array.from({ length: 50 }, (_, rank) => indexForRank(rank));
    const backward = Array.from({ length: 50 }, (_, i) => indexForRank(49 - i)).reverse();
    expect(backward).toEqual(forward);
  });
});

describe("claimAt", () => {
  it("prefers the table over the generic filler", () => {
    for (const [cellKey, amenity] of CLAIMED) {
      const index = curveIndexOf(cellKey);
      expect(claimAt(index)).toBe(amenity);
    }
  });

  it("hands out filler every FILLER_EVERY free cells, cycling through FILLER_CYCLE", () => {
    let free = 0;
    const handedOut: string[] = [];
    for (let index = 0; index < 600; index++) {
      if (CLAIMED.has(key(curveCell(index)))) continue;
      free++;
      const amenity = claimAt(index);
      if (free % FILLER_EVERY === 0) handedOut.push(amenity!);
      else expect(amenity).toBeNull();
    }
    expect(handedOut.length).toBeGreaterThan(4);
    expect(handedOut.slice(0, FILLER_CYCLE.length * 2)).toEqual([...FILLER_CYCLE, ...FILLER_CYCLE]);
  });
});

describe("claimedUpTo", () => {
  it("is empty for an empty park", () => {
    expect(claimedUpTo(0)).toEqual([]);
  });

  it("already shows the Goffert and the Stevenskerk at ten sessions", () => {
    const amenities = claimedUpTo(10).map((claim) => claim.amenity);
    expect(amenities).toContain("goffert");
    expect(amenities).toContain("stevenskerk");
  });

  it("puts the Stevenskerk on cell 1:1 whether the park holds 5 or 300 sessions", () => {
    for (const sessions of [5, 300]) {
      const church = claimedUpTo(sessions).find((claim) => claim.amenity === "stevenskerk");
      expect(church?.cell).toEqual({ col: 1, row: 1 });
    }
  });

  it("only grows as the park grows, and every entry sits on its own index", () => {
    const small = claimedUpTo(10);
    const large = claimedUpTo(300);
    expect(large.slice(0, small.length)).toEqual(small);
    expect(new Set(large.map((claim) => claim.index)).size).toBe(large.length);
    for (const claim of large) expect(claim.cell).toEqual(curveCell(claim.index));
  });

  it("covers the curve up to the last session, so no claim is skipped", () => {
    const last = indexForRank(9);
    const expected = [];
    for (let index = 0; index <= last; index++) {
      const amenity = claimAt(index);
      if (amenity) expected.push({ index, cell: curveCell(index), amenity });
    }
    expect(claimedUpTo(10)).toEqual(expected);
  });
});

describe("the Waal", () => {
  it("runs along one horizontal cell edge and no other", () => {
    expect(isWaterEdge(WAAL_EDGE)).toBe(true);
    for (const row of [0, 1, 3, 4, 10]) expect(isWaterEdge(row)).toBe(false);
  });

  it("is crossed on the bridge columns and nowhere else close by", () => {
    for (const { col, kind } of BRIDGES) expect(crossingAt(col)).toBe(kind);
    expect(crossingAt(0)).toBeNull();
    expect(crossingAt(2)).toBeNull();
  });

  it("gets a plain crossing every 5 columns from column 8 on", () => {
    for (const col of [8, 13, 18, 23]) expect(crossingAt(col)).toBe("plain");
    for (const col of [7, 9, 12, 14]) expect(crossingAt(col)).toBeNull();
  });
});

// The curve index of a cell, by walking the curve until it turns up.
function curveIndexOf(cellKey: string): number {
  for (let index = 0; index < 4096; index++) if (key(curveCell(index)) === cellKey) return index;
  throw new Error(`cell ${cellKey} is not on the curve`);
}
