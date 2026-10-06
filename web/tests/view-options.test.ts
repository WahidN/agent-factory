import { describe, expect, it } from "vitest";
import { viewOptionsFrom } from "../view-options.ts";

describe("viewOptionsFrom", () => {
  it("keeps the normal one-time fit by default", () => {
    expect(viewOptionsFrom("")).toEqual({
      autoFit: false,
      fitScale: 1,
      tour: false,
      demoEvents: false,
      clockMinutes: null,
      weekday: null,
    });
  });

  it("enables a persistent whole-city view", () => {
    expect(viewOptionsFrom("?view=all").autoFit).toBe(true);
    expect(viewOptionsFrom("?mode=showcase")).toMatchObject({ autoFit: true, fitScale: 1.35 });
  });

  it("accepts a bounded fit zoom multiplier", () => {
    expect(viewOptionsFrom("?zoom=1.2").fitScale).toBe(1.2);
    expect(viewOptionsFrom("?zoom=99").fitScale).toBe(1.35);
    expect(viewOptionsFrom("?zoom=nope").fitScale).toBe(1);
  });

  it("turns the tour on for ?tour with or without a value", () => {
    expect(viewOptionsFrom("?tour").tour).toBe(true);
    expect(viewOptionsFrom("?tour=1").tour).toBe(true);
    expect(viewOptionsFrom("?view=all").tour).toBe(false);
  });

  it("turns demo events on only for demo=events", () => {
    expect(viewOptionsFrom("?demo=events").demoEvents).toBe(true);
    expect(viewOptionsFrom("?demo=other").demoEvents).toBe(false);
  });

  it("parses clock=HH:MM into minutes since midnight", () => {
    expect(viewOptionsFrom("?clock=00:00").clockMinutes).toBe(0);
    expect(viewOptionsFrom("?clock=21:30").clockMinutes).toBe(1290);
    expect(viewOptionsFrom("?clock=23:59").clockMinutes).toBe(1439);
  });

  it("ignores a malformed or out-of-range clock", () => {
    for (const bad of ["24:00", "12:60", "9", "ab:cd", "", "1:5"]) {
      expect(viewOptionsFrom(`?clock=${bad}`).clockMinutes).toBeNull();
    }
  });

  it("parses weekday 1 to 7 and ignores the rest", () => {
    expect(viewOptionsFrom("?weekday=5").weekday).toBe(5);
    expect(viewOptionsFrom("?weekday=1").weekday).toBe(1);
    expect(viewOptionsFrom("?weekday=7").weekday).toBe(7);
    for (const bad of ["0", "8", "x", "2.5", ""]) {
      expect(viewOptionsFrom(`?weekday=${bad}`).weekday).toBeNull();
    }
  });
});
