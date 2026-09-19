// What a claimed cell draws inside itself.
//
// A builder works in cell-local coordinates: the origin is the middle of the
// cell, y = 0 is the ground the sidewalks sit on, and +z is north. The cell is
// PLOT_SIZE wide, but the outer ring carries road, verge and sidewalk, so a
// builder stays inside the same 40 by 40 block a factory yard uses: x and z
// both between -YARD_HALF and YARD_HALF. Anything wider pokes through the
// pavement.
//
// `rand` is seeded per cell, so a builder may vary itself freely and every
// viewer still sees the same city. A builder must not use Math.random.

import type { StaticBuilder } from "./static-builder.ts";

export type CellBuilder = (b: StaticBuilder, rand: () => number) => void;

// Half the buildable block, the same as the fenced yard of a factory lot.
export const CELL_HALF = 20;
