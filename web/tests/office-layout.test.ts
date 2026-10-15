import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  DESK,
  DOOR_ZONE,
  deskPhase,
  deskSpots,
  deskZone,
  doorSpot,
  FAR_ZONE,
  HALL_WIDTH,
  MEETING_DOOR_WIDTH,
  meetingDoorZ,
  meetingRooms,
  meetingScreenZ,
  officeRoom,
  PITCH,
  planterSpots,
  robotSpot,
  ROBOT_SEAT,
  subagentSpots,
  WALKWAY_HALF,
  WALL_GAP,
  zoneSpots,
} from "../office-layout.ts";
import { WALKER_RADIUS } from "../walk.ts";

const COUNTS = [1, 3, 9, 30];

describe("officeRoom", () => {
  it("keeps the same width and only grows in length", () => {
    for (const count of [0, 1, 4, 30]) expect(officeRoom(count).width).toBe(HALL_WIDTH);
    expect(officeRoom(30).depth).toBeGreaterThan(officeRoom(4).depth);
  });

  it("grows a row at a time, not a desk at a time", () => {
    expect(officeRoom(4).depth).toBe(officeRoom(1).depth);
    expect(officeRoom(8).depth).toBe(officeRoom(5).depth);
    expect(officeRoom(9).depth).toBe(officeRoom(8).depth + PITCH.z);
  });
});

describe("deskSpots", () => {
  it("gives one spot per desk in rows of four", () => {
    expect(deskSpots(9)).toHaveLength(9);
    const rows = new Set(deskSpots(9).map((spot) => spot.z));
    expect(rows.size).toBe(3);
  });

  it("starts with the desks next to the walkway", () => {
    const [first, second] = deskSpots(2);
    expect(Math.abs(first.x)).toBe(Math.abs(second.x));
    expect(first.x).toBe(-second.x);
    expect(Math.abs(first.x) - DESK.width / 2).toBeGreaterThan(WALKWAY_HALF);
  });

  it("never puts a desk on the walkway", () => {
    for (const count of COUNTS) {
      for (const desk of deskSpots(count)) {
        expect(Math.abs(desk.x) - DESK.width / 2).toBeGreaterThan(WALKWAY_HALF);
      }
    }
  });

  for (const count of COUNTS) {
    it(`keeps ${count} desks, robots and subagents inside the desk zone`, () => {
      const room = officeRoom(count);
      const zone = deskZone(count);
      for (const desk of deskSpots(count)) {
        const parts = [desk, robotSpot(desk), ...subagentSpots(desk, 4)];
        for (const part of parts) {
          expect(Math.abs(part.x) + DESK.width / 2).toBeLessThanOrEqual(room.width / 2);
          expect(part.z + DESK.depth / 2).toBeLessThanOrEqual(zone.near);
          expect(part.z - DESK.depth / 2).toBeGreaterThanOrEqual(zone.far);
        }
      }
    });
  }

  it("leaves a walkway between the rows you can get through", () => {
    const spots = deskSpots(9);
    // Row to row, minus the desk in front and the robot sitting at it.
    const gap = spots[0].z - spots[4].z - DESK.depth / 2 - ROBOT_SEAT - 0.3;
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

  it("leaves the door end and the far end as long as they are meant to be", () => {
    for (const count of COUNTS) {
      const { depth } = officeRoom(count);
      const zone = deskZone(count);
      expect(depth / 2 - zone.near).toBe(DOOR_ZONE);
      expect(zone.far + depth / 2).toBe(FAR_ZONE);
    }
  });
});

describe("planterSpots", () => {
  it("has none for a single row and one per desk of the later rows", () => {
    expect(planterSpots(4)).toHaveLength(0);
    expect(planterSpots(6)).toHaveLength(2);
  });

  it("stands between two rows, not on a desk or a robot", () => {
    const desks = deskSpots(8);
    for (const planter of planterSpots(8)) {
      for (const desk of desks) {
        if (desk.x !== planter.x) continue;
        expect(Math.abs(planter.z - desk.z)).toBeGreaterThan(1.3);
      }
    }
  });
});

describe("zoneSpots", () => {
  for (const count of COUNTS) {
    it(`keeps the far end for ${count} desks inside the room and behind the last row`, () => {
      const { depth } = officeRoom(count);
      const zones = zoneSpots(count);
      const lastDesk = Math.min(...deskSpots(count).map((spot) => spot.z));
      const lunchTables = zones.lunch.zs.map((z) => ({ z }));
      const spots = [
        zones.cabinets,
        zones.island,
        zones.roundTable,
        zones.printer,
        zones.whiteboard,
        ...zones.bins,
        ...zones.stools,
        ...lunchTables,
      ];
      for (const spot of spots) {
        expect(spot.z).toBeGreaterThan(-depth / 2);
        expect(spot.z + 1.7).toBeLessThan(lastDesk - DESK.depth / 2);
      }
      for (const piece of [zones.printer, zones.whiteboard]) {
        expect(Math.abs(piece.x) + piece.halfX).toBeLessThan(HALL_WIDTH / 2 - WALKER_RADIUS * 2);
      }
    });
  }

  it("leaves a way round the round table's chairs past the whiteboard", () => {
    const { whiteboard, roundTable } = zoneSpots(4);
    const chairReach = 1.55 + 0.3;
    const gap = Math.abs(whiteboard.x - roundTable.x) - whiteboard.halfX - chairReach;
    expect(gap).toBeGreaterThan(WALKER_RADIUS * 2);
  });

  it("keeps the lunch tables clear of the island and its stools", () => {
    const zones = zoneSpots(4);
    const nearestTable = Math.min(...zones.lunch.zs);
    const stoolRow = zones.stools[0].z;
    expect(nearestTable - zones.lunch.halfZ - 1.1).toBeGreaterThan(stoolRow + 0.5);
  });

  it("keeps the walkway clear", () => {
    const zones = zoneSpots(4);
    expect(zones.island.x - zones.island.halfX).toBeGreaterThan(WALKWAY_HALF + WALKER_RADIUS);
    expect(zones.lunch.x - zones.lunch.halfX).toBeGreaterThan(WALKWAY_HALF + WALKER_RADIUS);
    expect(Math.min(...zones.stools.map((stool) => stool.x))).toBeGreaterThan(WALKWAY_HALF + WALKER_RADIUS);
    expect(Math.min(...zones.bins.map((bin) => bin.x))).toBeGreaterThan(WALKWAY_HALF + WALKER_RADIUS);
    expect(Math.abs(zones.printer.x) - zones.printer.halfX).toBeGreaterThan(WALKWAY_HALF + WALKER_RADIUS);
  });
});

describe("meetingRooms", () => {
  it("splits the desk zone into rooms that fill it exactly", () => {
    for (const count of COUNTS) {
      const zone = deskZone(count);
      const rooms = meetingRooms(count);
      expect(rooms.length).toBeGreaterThan(0);
      const total = rooms.reduce((sum, room) => sum + room.length, 0);
      expect(total).toBeCloseTo(zone.near - zone.far);
    }
  });

  // The table runs 1.3 each way down the room and the screen is 0.25 deep.
  it("stands every screen inside its room and clear of the table", () => {
    for (const count of COUNTS) {
      for (const room of meetingRooms(count)) {
        const z = meetingScreenZ(room);
        expect(z - 0.25).toBeGreaterThan(room.z - room.length / 2);
        expect(room.z - 1.3 - (z + 0.25)).toBeGreaterThan(WALKER_RADIUS * 2);
      }
    }
  });

  it("opens every doorway between glass on both sides, clear of the table", () => {
    for (const count of COUNTS) {
      for (const room of meetingRooms(count)) {
        const near = meetingDoorZ(room) + MEETING_DOOR_WIDTH / 2;
        const far = meetingDoorZ(room) - MEETING_DOOR_WIDTH / 2;
        expect(near).toBeLessThan(room.z + room.length / 2 - 0.3);
        expect(far - (room.z + 1.3)).toBeGreaterThan(WALKER_RADIUS * 2);
        // The open door leaf slides over the pane on the table side of the doorway.
        expect(far - MEETING_DOOR_WIDTH).toBeGreaterThan(room.z - room.length / 2);
      }
    }
  });

  it("makes a doorway you can walk through", () => {
    expect(MEETING_DOOR_WIDTH).toBeGreaterThan(WALKER_RADIUS * 2 + 0.3);
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
