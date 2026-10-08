import { describe, expect, it } from "vitest";
import { createKudosLimiter, parseViewerMessage } from "../kudos.ts";

describe("parseViewerMessage", () => {
  it("accepts a valid kudos", () => {
    expect(parseViewerMessage('{"type":"kudos","user":"dennis"}')).toEqual({ type: "kudos", user: "dennis" });
  });

  it("refuses a message over 256 bytes", () => {
    expect(parseViewerMessage(JSON.stringify({ type: "kudos", user: "a", pad: "x".repeat(300) }))).toBeNull();
  });

  it("counts bytes, not characters", () => {
    // Valid in every other way and under 256 characters, but over 256 bytes.
    const padded = `{"type":"kudos","user":"${"é".repeat(60)}"}${" ".repeat(130)}`;
    expect(padded.length).toBeLessThan(256);
    expect(Buffer.byteLength(padded)).toBeGreaterThan(256);
    expect(parseViewerMessage(padded)).toBeNull();
  });

  it("accepts exactly 256 bytes and refuses 257", () => {
    const base = '{"type":"kudos","user":"dennis"}';
    expect(parseViewerMessage(base + " ".repeat(256 - base.length))).not.toBeNull();
    expect(parseViewerMessage(base + " ".repeat(257 - base.length))).toBeNull();
  });

  it("refuses broken JSON", () => {
    expect(parseViewerMessage("{nope")).toBeNull();
  });

  it("refuses another type", () => {
    expect(parseViewerMessage('{"type":"snapshot","user":"dennis"}')).toBeNull();
  });

  it("refuses an extra field", () => {
    expect(parseViewerMessage('{"type":"kudos","user":"dennis","x":1}')).toBeNull();
  });

  it("refuses a missing user", () => {
    expect(parseViewerMessage('{"type":"kudos"}')).toBeNull();
  });

  it("refuses an empty or non-string user", () => {
    expect(parseViewerMessage('{"type":"kudos","user":""}')).toBeNull();
    expect(parseViewerMessage('{"type":"kudos","user":null}')).toBeNull();
    expect(parseViewerMessage('{"type":"kudos","user":5}')).toBeNull();
  });

  it("refuses a user over 64 characters and accepts exactly 64", () => {
    expect(parseViewerMessage(JSON.stringify({ type: "kudos", user: "a".repeat(65) }))).toBeNull();
    expect(parseViewerMessage(JSON.stringify({ type: "kudos", user: "a".repeat(64) }))).not.toBeNull();
  });

  it("refuses JSON that is not an object", () => {
    expect(parseViewerMessage("null")).toBeNull();
    expect(parseViewerMessage("[]")).toBeNull();
  });
});

describe("createKudosLimiter", () => {
  it("refuses a second kudos within 2 seconds", () => {
    let now = 10_000;
    const allow = createKudosLimiter(() => now);
    expect(allow()).toBe(true);
    now += 1_999;
    expect(allow()).toBe(false);
  });

  it("allows again after 2 seconds", () => {
    let now = 10_000;
    const allow = createKudosLimiter(() => now);
    expect(allow()).toBe(true);
    now += 2_000;
    expect(allow()).toBe(true);
  });

  it("does not extend the window by refused attempts", () => {
    let now = 10_000;
    const allow = createKudosLimiter(() => now);
    allow();
    now += 1_500;
    allow();
    now += 600;
    expect(allow()).toBe(true);
  });
});
