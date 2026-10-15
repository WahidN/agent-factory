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

// The hall is a fixed width and grows only in length, so the walkway down the
// middle stays the same whatever the number of sessions is.
export const HALL_WIDTH = 28;
export const WALKWAY_HALF = 1.6;

// Walkway between the outer desks and the walls.
export const WALL_GAP = 1.6;

// From the door to the first row, and from the last row to the far wall. The
// door end holds the moss wall, the far end the kitchen and the tables.
export const DOOR_ZONE = 9;
export const FAR_ZONE = 16;
export const MIN_ROWS = 2;

// The same cap the yard puts on warehouses, so one session shows the same
// number of subagents inside as outside.
export const MAX_SUBAGENTS = 4;

export type Spot = { x: number; z: number };

// Inner columns first, so one or two sessions sit next to the walkway.
const COLUMN_XS = [-PITCH.x, PITCH.x, -2 * PITCH.x, 2 * PITCH.x];

function rowCount(deskCount: number): number {
  return Math.max(MIN_ROWS, Math.ceil(deskCount / COLUMNS));
}

export function officeRoom(deskCount: number): { width: number; depth: number } {
  return { width: HALL_WIDTH, depth: DOOR_ZONE + rowCount(deskCount) * PITCH.z + FAR_ZONE };
}

// The desks, filled from the door end toward the kitchen, so the first thing
// you walk up to is a desk.
export function deskSpots(deskCount: number): Spot[] {
  const { depth } = officeRoom(deskCount);
  const spots: Spot[] = [];
  for (let i = 0; i < deskCount; i++) {
    const row = Math.floor(i / COLUMNS);
    spots.push({ x: COLUMN_XS[i % COLUMNS], z: depth / 2 - DOOR_ZONE - PITCH.z * (row + 0.5) });
  }
  return spots;
}

// A planter stands between two rows, in the column of the desk behind it.
export function planterSpots(deskCount: number): Spot[] {
  const desks = deskSpots(deskCount);
  return desks.filter((_desk, i) => i >= COLUMNS).map((desk) => ({ x: desk.x, z: desk.z + PITCH.z / 2 }));
}

export type Zones = {
  cabinets: Spot & { halfX: number; halfZ: number };
  island: Spot & { halfX: number; halfZ: number };
  bins: Spot[];
  stools: Spot[];
  roundTable: Spot;
  lunch: { x: number; zs: [number, number]; halfX: number; halfZ: number };
  triangleWindow: Spot;
};

// Everything at the far end, measured from the far wall.
export function zoneSpots(deskCount: number): Zones {
  const far = -officeRoom(deskCount).depth / 2;
  return {
    cabinets: { x: 8.5, z: far + 0.4, halfX: 5.5, halfZ: 0.4 },
    island: { x: 8.5, z: far + 3.2, halfX: 2.6, halfZ: 0.55 },
    bins: [
      { x: 3.1, z: far + 3 },
      { x: 3.75, z: far + 3 },
    ],
    stools: [-1.8, -0.6, 0.6, 1.8].map((dx) => ({ x: 8.5 + dx, z: far + 4.2 })),
    roundTable: { x: -6.5, z: far + 6 },
    lunch: { x: 7.5, zs: [far + 9.2, far + 10.5], halfX: 2.75, halfZ: 0.5 },
    triangleWindow: { x: -6.5, z: far },
  };
}

// The glass meeting rooms along the desk zone, one per ROOM_LENGTH.
export const GLASS_X = 10.4;
const ROOM_LENGTH = 7;

export function deskZone(deskCount: number): { near: number; far: number } {
  const { depth } = officeRoom(deskCount);
  return { near: depth / 2 - DOOR_ZONE, far: -depth / 2 + FAR_ZONE };
}

export function meetingRooms(deskCount: number): { z: number; length: number }[] {
  const { near, far } = deskZone(deskCount);
  const count = Math.max(1, Math.floor((near - far) / ROOM_LENGTH));
  const length = (near - far) / count;
  return Array.from({ length: count }, (_, i) => ({ z: near - length * (i + 0.5), length }));
}

// The half-round windows in the long walls, one per meeting room.
export function sideWindowSpots(deskCount: number): number[] {
  return meetingRooms(deskCount).map((room) => room.z);
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
