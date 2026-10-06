import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { amsterdamClock, daylightAt } from "../daylight.ts";

const at = (hours: number, minutes = 0) => hours * 60 + minutes;

describe("daylightAt", () => {
  it("keeps today's look at noon, per style", () => {
    const classic = daylightAt(at(12), 3, false);
    expect(classic.sky.getHexString()).toBe("a9ced7");
    expect(classic.sunIntensity).toBe(2.75);
    expect(classic.hemiIntensity).toBe(1.55);
    expect(classic.lampGlow).toBe(0.6);

    const ink = daylightAt(at(12), 3, true);
    expect(ink.sky.getHexString()).toBe("797fa3");
    expect(ink.sunIntensity).toBe(2.65);
    expect(ink.hemiIntensity).toBe(1.45);
  });

  it("glows the lamps and dims the sun at night", () => {
    const night = daylightAt(at(23), 3, false);
    const day = daylightAt(at(12), 3, false);
    expect(night.lampGlow).toBeGreaterThan(2);
    expect(night.sunIntensity).toBeLessThan(day.sunIntensity);
    expect(night.sky.b).toBeGreaterThan(night.sky.r);
    expect(daylightAt(at(23), 3, true).sky.getHexString()).not.toBe(night.sky.getHexString());
  });

  it("sits between day and night at dusk", () => {
    const dusk = daylightAt(at(19), 3, false);
    const day = daylightAt(at(12), 3, false);
    const night = daylightAt(at(23), 3, false);
    expect(dusk.lampGlow).toBeGreaterThan(day.lampGlow);
    expect(dusk.lampGlow).toBeLessThan(night.lampGlow);
    expect(dusk.sky.getHex()).not.toBe(day.sky.getHex());
    expect(dusk.sky.getHex()).not.toBe(night.sky.getHex());
  });

  it("changes continuously with the minute", () => {
    for (let m = 0; m < 1440; m++) {
      const a = daylightAt(m, 3, false);
      const b = daylightAt(m + 1, 3, false);
      expect(Math.abs(a.lampGlow - b.lampGlow)).toBeLessThan(0.1);
      expect(Math.abs(a.sunIntensity - b.sunIntensity)).toBeLessThan(0.1);
    }
  });

  it("doubles the terraces on Friday 16:00 to 20:00 only", () => {
    expect(daylightAt(at(17), 5, false).terraceBoost).toBe(2);
    expect(daylightAt(at(17), 4, false).terraceBoost).toBe(1);
    expect(daylightAt(at(21), 5, false).terraceBoost).toBe(1);
    expect(daylightAt(at(15, 59), 5, false).terraceBoost).toBe(1);
    expect(daylightAt(at(20), 5, false).terraceBoost).toBe(1);
  });

  it("returns a fresh color each call", () => {
    const a = daylightAt(at(12), 3, false);
    a.sky.set("#000000");
    expect(daylightAt(at(12), 3, false).sky).toBeInstanceOf(THREE.Color);
    expect(daylightAt(at(12), 3, false).sky.getHexString()).toBe("a9ced7");
  });
});

describe("amsterdamClock", () => {
  it("does not build a new Intl.DateTimeFormat per call", () => {
    const spy = vi.spyOn(Intl, "DateTimeFormat");
    amsterdamClock(new Date("2026-07-10T15:30:00Z"));
    amsterdamClock(new Date("2026-07-10T15:31:00Z"));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("uses summer time (UTC+2)", () => {
    // Friday 2026-07-10 15:30 UTC is 17:30 in Amsterdam.
    expect(amsterdamClock(new Date("2026-07-10T15:30:00Z"))).toEqual({ minutes: 17 * 60 + 30, weekday: 5 });
  });

  it("uses winter time (UTC+1)", () => {
    // Sunday 2026-01-11 23:30 UTC is Monday 00:30 in Amsterdam.
    expect(amsterdamClock(new Date("2026-01-11T23:30:00Z"))).toEqual({ minutes: 30, weekday: 1 });
  });
});
