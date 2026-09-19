import { describe, expect, it } from "vitest";
import { cityActivity, eventModeForTime } from "../city-activity.ts";

describe("city activity", () => {
  it("selects a different live theme every local clock hour", () => {
    const events = Array.from({ length: 25 }, (_, hour) => eventModeForTime(new Date(2026, 8, 18, hour)));
    expect(new Set(events).size).toBe(3);
    for (let hour = 1; hour < events.length; hour++) expect(events[hour]).not.toBe(events[hour - 1]);
  });

  it("derives the normalised activity from live sessions", () => {
    const sessions = [{ status: "busy" as const }, { status: "idle" as const }, { status: "busy" as const }];
    expect(cityActivity(sessions, 19, "nec-matchday")).toEqual({
      hour: 19,
      busyRatio: 2 / 3,
      event: "nec-matchday",
    });
  });
});
