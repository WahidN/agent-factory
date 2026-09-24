import { describe, expect, it } from "vitest";
import { average, percentile95, RingBuffer, statsRequested } from "../stats.ts";

describe("statsRequested", () => {
  it("is true only when ?stats is present", () => {
    expect(statsRequested("?stats")).toBe(true);
    expect(statsRequested("?stats=1")).toBe(true);
    expect(statsRequested("?other=1")).toBe(false);
    expect(statsRequested("")).toBe(false);
  });
});

describe("RingBuffer", () => {
  it("keeps only the most recent values once full", () => {
    const buf = new RingBuffer(3);
    for (const v of [1, 2, 3, 4, 5]) buf.push(v);
    expect(buf.values()).toEqual([3, 4, 5]);
  });

  it("holds everything below capacity", () => {
    const buf = new RingBuffer(5);
    buf.push(1);
    buf.push(2);
    expect(buf.values()).toEqual([1, 2]);
  });
});

describe("average", () => {
  it("is 0 for an empty window", () => {
    expect(average([])).toBe(0);
  });

  it("averages the samples", () => {
    expect(average([10, 20, 30])).toBe(20);
  });
});

describe("percentile95", () => {
  it("is 0 for an empty window", () => {
    expect(percentile95([])).toBe(0);
  });

  it("is the max when every sample is equal", () => {
    expect(percentile95([16, 16, 16, 16])).toBe(16);
  });

  it("picks the value near the top of the sorted window, not an outlier average", () => {
    // 100 frames at 16ms, 5 stutters at 200ms: the average is dragged up,
    // but p95 should still read close to the steady 16ms frame time.
    const values = [...Array(100).fill(16), ...Array(5).fill(200)];
    expect(percentile95(values)).toBe(16);
    expect(average(values)).toBeGreaterThan(20);
  });

  it("reports the outlier once it is more than 5% of the window", () => {
    const values = [...Array(90).fill(16), ...Array(10).fill(200)];
    expect(percentile95(values)).toBe(200);
  });
});
