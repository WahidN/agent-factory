import { describe, expect, it } from "vitest";
import { Activity, FADE_S, HOLD_MS } from "../activity.ts";

// Steps a fake clock in 1/60 second frames.
function run(activity: Activity, clock: { ms: number }, untilMs: number) {
  const values: { ms: number; value: number }[] = [];
  const dt = 1 / 60;
  while (clock.ms < untilMs) {
    clock.ms += dt * 1000;
    values.push({ ms: clock.ms, value: activity.update(dt, clock.ms) });
  }
  return values;
}

describe("Activity", () => {
  it("fades in fully over 0.3 seconds", () => {
    const activity = new Activity();
    const clock = { ms: 0 };
    activity.set(true, clock.ms);
    run(activity, clock, FADE_S * 1000 - 20);
    expect(activity.value).toBeLessThan(1);
    run(activity, clock, FADE_S * 1000 + 20);
    expect(activity.value).toBe(1);
  });

  it("a 200 ms tool keeps its part active for at least 0.6 seconds", () => {
    const activity = new Activity();
    const clock = { ms: 0 };
    activity.set(true, clock.ms);
    run(activity, clock, 200);
    activity.set(false, clock.ms);

    const held = run(activity, clock, HOLD_MS - 20);
    expect(activity.value).toBe(1);
    expect(held.every((f) => f.value > 0)).toBe(true);

    run(activity, clock, HOLD_MS + FADE_S * 1000 + 20);
    expect(activity.value).toBe(0);
  });

  it("stays on while the tool keeps running past the hold", () => {
    const activity = new Activity();
    const clock = { ms: 0 };
    activity.set(true, clock.ms);
    run(activity, clock, 3000);
    expect(activity.value).toBe(1);
  });

  it("repeating set(true) does not extend the hold", () => {
    const activity = new Activity();
    const clock = { ms: 0 };
    activity.set(true, 0);
    run(activity, clock, 500);
    activity.set(true, clock.ms);
    activity.set(false, clock.ms);
    run(activity, clock, HOLD_MS + FADE_S * 1000 + 20);
    expect(activity.value).toBe(0);
  });
});
