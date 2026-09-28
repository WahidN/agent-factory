import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { MILESTONES } from "../milestone-ladder.ts";
import { buildHqMilestones, buildLotMilestones } from "../milestones.ts";
import { StaticBuilder } from "../static-builder.ts";

const accent = new THREE.MeshStandardMaterial();
const tower = { x0: -9, z0: -16, x1: 5, z1: -2, top: 20 };

// How much a group holds, as one number. A row that builds nothing leaves it
// where it was, which is how the rows are told apart below.
function vertices(group: THREE.Group): number {
  let total = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) total += child.geometry.attributes.position.count;
  });
  return total;
}

function lotSize(count: number): number {
  const builder = new StaticBuilder();
  buildLotMilestones(builder, count, { accent });
  return vertices(builder.build());
}

function hqSize(count: number): number {
  const builder = new StaticBuilder();
  const animated = buildHqMilestones(builder, count, { accent, tower });
  return vertices(builder.build()) + animated.reduce((sum, extra) => sum + vertices(extra.group), 0);
}

// The rows that actually put something in a place: the index grows the build.
function rowsBuiltBy(size: (count: number) => number): number[] {
  return MILESTONES.map((_, index) => index).filter((index) => size(index + 1) > size(index));
}

describe("the milestone rows", () => {
  it("puts the flagpole, helipad, turbine and blimp on the HQ", () => {
    expect(rowsBuiltBy(hqSize)).toEqual([3, 7, 8, 9]);
  });

  it("keeps the rest in the yard", () => {
    // Rows 2, 3 and 4 add a parked car, which the lot adds itself through
    // addParkedCars, so only the bike rack, coffee corner, truck and chargers
    // are built from the table.
    expect(rowsBuiltBy(lotSize)).toEqual([0, 4, 5, 6]);
  });

  it("never builds the same row in both places", () => {
    const hq = rowsBuiltBy(hqSize);
    expect(rowsBuiltBy(lotSize).filter((index) => hq.includes(index))).toEqual([]);
  });

  it("moves the turbine and the blimp, and nothing else", () => {
    expect(buildHqMilestones(new StaticBuilder(), MILESTONES.length, { accent, tower })).toHaveLength(2);
    expect(buildHqMilestones(new StaticBuilder(), 8, { accent, tower })).toHaveLength(0);
  });
});
