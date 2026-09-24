import { describe, expect, it } from "vitest";
import { createMetrics } from "../metrics.ts";

describe("createMetrics", () => {
  it("starts with nobody connected and no traffic", () => {
    const metrics = createMetrics();
    expect(metrics.snapshot(0)).toEqual({ connected: 0, messagesPerSecond: 0, machines: [] });
  });

  it("counts a joined machine and remembers its protocol", () => {
    const metrics = createMetrics();
    metrics.join("wahid", 2, 1_000);
    const snapshot = metrics.snapshot(1_000);
    expect(snapshot.connected).toBe(1);
    expect(snapshot.machines).toEqual([{ machine: "wahid", protocol: 2, lastMessageAt: 1_000 }]);
  });

  it("a leave removes the machine", () => {
    const metrics = createMetrics();
    metrics.join("wahid", 2, 1_000);
    metrics.leave("wahid");
    expect(metrics.snapshot(1_000)).toEqual({ connected: 0, messagesPerSecond: 0, machines: [] });
  });

  it("a message bumps the machine's lastMessageAt", () => {
    const metrics = createMetrics();
    metrics.join("wahid", 2, 1_000);
    metrics.message("wahid", 5_000);
    expect(metrics.snapshot(5_000).machines[0].lastMessageAt).toBe(5_000);
  });

  it("counts messages per second over a 10 second window", () => {
    const metrics = createMetrics();
    metrics.join("wahid", 2, 0);
    for (let i = 0; i < 20; i++) metrics.message("wahid", 0);
    expect(metrics.snapshot(0).messagesPerSecond).toBe(2); // 20 messages / 10 s
  });

  it("drops messages older than the window from the rate", () => {
    const metrics = createMetrics();
    metrics.join("wahid", 2, 0);
    metrics.message("wahid", 0);
    metrics.message("wahid", 1_000);
    expect(metrics.snapshot(11_001).messagesPerSecond).toBe(0);
  });

  it("sorts machines by name", () => {
    const metrics = createMetrics();
    metrics.join("zed", 2, 0);
    metrics.join("anna", 2, 0);
    expect(metrics.snapshot(0).machines.map((m) => m.machine)).toEqual(["anna", "zed"]);
  });
});
