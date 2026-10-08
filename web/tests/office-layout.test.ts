import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  DESK,
  deskPhase,
  deskSpots,
  doorSpot,
  officeRoom,
  PITCH,
  robotSpot,
  ROBOT_SEAT,
  ROOM_MIN,
  subagentSpots,
  WALL_GAP,
} from "../office-layout.ts";
import { WALKER_RADIUS } from "../walk.ts";

const COUNTS = [1, 3, 9, 30];

describe("officeRoom", () => {
  it("never goes below the tower's own footprint", () => {
    for (const count of [0, 1, 4]) {
      const room = officeRoom(count);
      expect(room.width).toBeGreaterThanOrEqual(ROOM_MIN.width);
      expect(room.depth).toBeGreaterThanOrEqual(ROOM_MIN.depth);
    }
  });

  it("grows a row at a time, not a desk at a time", () => {
    expect(officeRoom(4).depth).toBe(officeRoom(1).depth);
    expect(officeRoom(30).depth).toBeGreaterThan(officeRoom(4).depth);
  });
});

describe("deskSpots", () => {
  it("gives one spot per desk in rows of four", () => {
    expect(deskSpots(9)).toHaveLength(9);
    const rows = new Set(deskSpots(9).map((spot) => spot.z));
    expect(rows.size).toBe(3);
  });

  it("centers a short last row", () => {
    const spots = deskSpots(6);
    const last = spots.slice(4);
    expect(last[0].x).toBe(-last[1].x);
  });

  for (const count of COUNTS) {
    it(`keeps ${count} desks, robots and subagents inside the room`, () => {
      const room = officeRoom(count);
      for (const desk of deskSpots(count)) {
        const parts = [desk, robotSpot(desk), ...subagentSpots(desk, 4)];
        for (const part of parts) {
          expect(Math.abs(part.x) + DESK.width / 2).toBeLessThanOrEqual(room.width / 2);
          expect(Math.abs(part.z) + DESK.depth / 2).toBeLessThanOrEqual(room.depth / 2);
        }
      }
    });
  }

  it("leaves a walkway between the rows you can get through", () => {
    const spots = deskSpots(9);
    // Row to row, minus the desk in front and the robot sitting at it.
    const gap = spots[4].z - spots[0].z - DESK.depth / 2 - ROBOT_SEAT - 0.3;
    expect(gap).toBeGreaterThan(WALKER_RADIUS * 2 + 0.4);
    expect(PITCH.z).toBeGreaterThan(DESK.depth);
  });

  it("puts the door clear of the desks", () => {
    for (const count of COUNTS) {
      const door = doorSpot(count);
      const nearest = Math.max(...deskSpots(count).map((spot) => spot.z));
      expect(door.z).toBeGreaterThan(nearest + DESK.depth);
      expect(door.z).toBeLessThan(officeRoom(count).depth / 2);
    }
  });
});

describe("subagentSpots", () => {
  it("caps at four however many are reported", () => {
    expect(subagentSpots({ x: 0, z: 0 }, 9)).toHaveLength(4);
    expect(subagentSpots({ x: 0, z: 0 }, 0)).toHaveLength(0);
  });

  it("stands beside the desk, not on it", () => {
    for (const spot of subagentSpots({ x: 0, z: 0 }, 4)) {
      expect(Math.abs(spot.x)).toBeGreaterThan(DESK.width / 2);
    }
  });

  it("stays clear of the next desk in the row", () => {
    for (const spot of subagentSpots({ x: 0, z: 0 }, 4)) {
      expect(Math.abs(spot.x)).toBeLessThan(PITCH.x - DESK.width / 2);
    }
  });
});

describe("deskPhase", () => {
  it("gives two sessions their own beat", () => {
    expect(deskPhase("showcase-01")).not.toBe(deskPhase("showcase-02"));
  });

  it("is the same every time for one session", () => {
    expect(deskPhase("showcase-01")).toBe(deskPhase("showcase-01"));
  });
});

describe("the room's own numbers", () => {
  it("keeps a walkway along the walls", () => {
    expect(WALL_GAP).toBeGreaterThan(WALKER_RADIUS * 2);
  });

  it("fills a row before starting the next", () => {
    expect(deskSpots(COLUMNS).every((spot) => spot.z === deskSpots(COLUMNS)[0].z)).toBe(true);
  });
});
