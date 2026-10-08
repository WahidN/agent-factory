// Where the desks stand on an office floor, how big the room has to be for
// them, and where a session's subagents stand next to their desk. Pure, no
// Three.js, so it is easy to test; office.ts turns this into geometry.
//
// Everything is in metres, the same scale the city uses: a worker in a yard is
// 1.9 tall. You walk this floor in the first person, so the numbers below are
// about getting through it, not only about fitting on it.

import { hashString } from "./plots.ts";

export const DESK = { width: 1.8, depth: 0.8 };

// The robot sits this far in front of its desk, on the door side, with its
// back to you as you come in. That is what puts its screens in view: a robot
// facing the door would hold its monitor up the other way round.
export const ROBOT_SEAT = 0.95;

// Desks per row, and the distance between two desks in x and two rows in z.
// The row pitch is the desk, the robot in front of it and a walkway of about
// 2; the column pitch leaves room for the subagents standing beside a desk.
export const COLUMNS = 4;
export const PITCH = { x: 3.6, z: 4 };

// Walkway between the outer desks and the walls.
export const WALL_GAP = 1.6;

// A whole floor of the tower, not the desks with a margin around them: you
// walk this room, so it has space that no desk stands in.
export const ROOM_MIN = { width: 30, depth: 26 };

// The same cap the yard puts on warehouses, so one session shows the same
// number of subagents inside as outside.
export const MAX_SUBAGENTS = 4;

export type Spot = { x: number; z: number };

export function officeRoom(deskCount: number): { width: number; depth: number } {
  const columns = Math.min(COLUMNS, Math.max(1, deskCount));
  const rows = Math.max(1, Math.ceil(deskCount / COLUMNS));
  return {
    width: Math.max(ROOM_MIN.width, columns * PITCH.x + 2 * WALL_GAP),
    depth: Math.max(ROOM_MIN.depth, rows * PITCH.z + 2 * WALL_GAP),
  };
}

// The desks, filled from the back wall forward, every row centered in the
// room. The door is in the +z wall, so the space that is left over is the
// space you walk into.
export function deskSpots(deskCount: number): Spot[] {
  const { depth } = officeRoom(deskCount);
  const spots: Spot[] = [];
  for (let i = 0; i < deskCount; i++) {
    const row = Math.floor(i / COLUMNS);
    const inRow = Math.min(COLUMNS, deskCount - row * COLUMNS);
    const column = i % COLUMNS;
    spots.push({
      x: (column - (inRow - 1) / 2) * PITCH.x,
      z: -depth / 2 + WALL_GAP + PITCH.z * (row + 0.5),
    });
  }
  return spots;
}

export function robotSpot(desk: Spot): Spot {
  return { x: desk.x, z: desk.z + ROBOT_SEAT };
}

// Beside the desk, near corner first, alternating left and right. They stand
// clear of the desk itself and of the next desk in the row.
const SUBAGENT_OFFSETS: Spot[] = [
  { x: -1.35, z: 0.1 },
  { x: 1.35, z: 0.1 },
  { x: -1.35, z: 0.95 },
  { x: 1.35, z: 0.95 },
];

export function subagentSpots(desk: Spot, count: number): Spot[] {
  return SUBAGENT_OFFSETS.slice(0, Math.max(0, Math.min(MAX_SUBAGENTS, count))).map((offset) => ({
    x: desk.x + offset.x,
    z: desk.z + offset.z,
  }));
}

// Where you stand when you walk in: just inside the door in the +z wall,
// looking into the room.
export function doorSpot(deskCount: number): Spot {
  return { x: 0, z: officeRoom(deskCount).depth / 2 - WALL_GAP };
}

// A robot's own beat, so two busy robots never tap in step. It comes from the
// session id, not from the desk index, so a robot keeps its beat when the desk
// next to it disappears.
export function deskPhase(id: string): number {
  return ((hashString(id) % 1000) / 1000) * Math.PI * 2;
}
