import { describe, expect, it } from "vitest";
import { SEASON_START, UsageLedger } from "../usage-ledger.ts";

describe("UsageLedger", () => {
  it("adds a new message", () => {
    const ledger = new UsageLedger(0);
    expect(ledger.add("msg_1|req_1", 1152, 0)).toBe(true);
    expect(ledger.total()).toBe(1152);
  });

  it("ignores a copy with a smaller or equal total", () => {
    const ledger = new UsageLedger(0);
    ledger.add("msg_1|req_1", 1182, 0);
    expect(ledger.add("msg_1|req_1", 1152, 0)).toBe(false);
    expect(ledger.add("msg_1|req_1", 1182, 0)).toBe(false);
    expect(ledger.total()).toBe(1182);
  });

  it("adds only the difference for a copy with a larger total", () => {
    const ledger = new UsageLedger(0);
    ledger.add("msg_1|req_1", 1152, 0);
    expect(ledger.add("msg_1|req_1", 1182, 0)).toBe(true);
    expect(ledger.total()).toBe(1182);
  });

  it("sums across messages", () => {
    const ledger = new UsageLedger(0);
    ledger.add("a", 100, 0);
    ledger.add("b", 200, 0);
    ledger.add("c", 300, 0);
    expect(ledger.total()).toBe(600);
  });

  it("adds nothing for a message without tokens", () => {
    const ledger = new UsageLedger(0);
    expect(ledger.add("empty", 0, 0)).toBe(false);
    expect(ledger.total()).toBe(0);
  });

  it("ignores a message from before the season start", () => {
    const ledger = new UsageLedger(SEASON_START);
    expect(ledger.add("old", 500, Date.parse("2026-09-15T23:59:59Z"))).toBe(false);
    expect(ledger.total()).toBe(0);
  });

  it("counts a message at the season start", () => {
    const ledger = new UsageLedger(SEASON_START);
    expect(ledger.add("new", 100, SEASON_START)).toBe(true);
    expect(ledger.total()).toBe(100);
  });
});
