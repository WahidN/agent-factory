import { describe, expect, it } from "vitest";
import { health, STALE_MS } from "../health.ts";

describe("health", () => {
  it("treats staleness as 120000 ms (two minutes)", () => {
    expect(STALE_MS).toBe(120_000);
  });

  it("is not ok when central mode has zero reporters", () => {
    const result = health({ mode: "central", reporters: 0, lastUpdateAt: 0, now: 1_000 });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(result.body).toEqual({ ok: false, mode: "central", reporters: 0, lastUpdateAgeMs: null });
  });

  it("is ok when central mode has reporters and nothing has been seen yet", () => {
    const result = health({ mode: "central", reporters: 2, lastUpdateAt: 0, now: 1_000 });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, mode: "central", reporters: 2, lastUpdateAgeMs: null });
  });

  it("is ok when central mode has reporters and a fresh update", () => {
    const result = health({ mode: "central", reporters: 1, lastUpdateAt: 900, now: 1_000 });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.body.lastUpdateAgeMs).toBe(100);
  });

  it("is not ok when central mode has reporters but the last update is stale", () => {
    const now = 1_000_000;
    const result = health({ mode: "central", reporters: 1, lastUpdateAt: now - STALE_MS - 1, now });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
  });

  it("is ok exactly at the stale boundary", () => {
    const now = 1_000_000;
    const result = health({ mode: "central", reporters: 1, lastUpdateAt: now - STALE_MS, now });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("is ok one millisecond under the stale boundary", () => {
    const now = 1_000_000;
    const result = health({ mode: "central", reporters: 1, lastUpdateAt: now - STALE_MS + 1, now });
    expect(result.ok).toBe(true);
  });

  it("is not ok one millisecond over the stale boundary", () => {
    const now = 1_000_000;
    const result = health({ mode: "central", reporters: 1, lastUpdateAt: now - STALE_MS - 1, now });
    expect(result.ok).toBe(false);
  });

  it("is ok in local mode with no reporters", () => {
    const result = health({ mode: "local", reporters: 0, lastUpdateAt: 0, now: 1_000 });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("is ok in local mode even when stale", () => {
    const now = 1_000_000;
    const result = health({ mode: "local", reporters: 0, lastUpdateAt: now - STALE_MS - 10_000, now });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("is ok in reporter mode with no reporters expected", () => {
    const result = health({ mode: "reporter", reporters: 0, lastUpdateAt: 0, now: 1_000 });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("is ok in reporter mode even when stale", () => {
    const now = 1_000_000;
    const result = health({ mode: "reporter", reporters: 0, lastUpdateAt: now - STALE_MS - 10_000, now });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("includes mode and reporter count in the body", () => {
    const result = health({ mode: "central", reporters: 3, lastUpdateAt: 500, now: 1_000 });
    expect(result.body.mode).toBe("central");
    expect(result.body.reporters).toBe(3);
  });
});
