import { describe, expect, it } from "vitest";
import { createHeartbeat } from "../heartbeat.ts";

describe("createHeartbeat", () => {
  it("gives back nobody to drop on the first tick", () => {
    const heartbeat = createHeartbeat();
    heartbeat.onConnect("a");
    expect(heartbeat.onTick()).toEqual([]);
  });

  it("drops a client only after it misses two ticks in a row", () => {
    const heartbeat = createHeartbeat();
    heartbeat.onConnect("a");
    expect(heartbeat.onTick()).toEqual([]); // missed 1
    expect(heartbeat.onTick()).toEqual(["a"]); // missed 2, drop
  });

  it("a pong resets the missed counter", () => {
    const heartbeat = createHeartbeat();
    heartbeat.onConnect("a");
    heartbeat.onTick(); // missed 1
    heartbeat.onPong("a");
    expect(heartbeat.onTick()).toEqual([]); // missed 1 again after the reset, not 2
    expect(heartbeat.onTick()).toEqual(["a"]); // missed 2, drop
  });

  it("forgetting a client stops it from ever being reported", () => {
    const heartbeat = createHeartbeat();
    heartbeat.onConnect("a");
    heartbeat.forget("a");
    expect(heartbeat.onTick()).toEqual([]);
    expect(heartbeat.onTick()).toEqual([]);
  });

  it("tracks several clients independently", () => {
    const heartbeat = createHeartbeat();
    heartbeat.onConnect("a");
    heartbeat.onConnect("b");
    heartbeat.onTick(); // both missed 1
    heartbeat.onPong("b");
    expect(heartbeat.onTick()).toEqual(["a"]); // a missed 2, b just reset
  });

  it("a dropped client is removed and not reported again", () => {
    const heartbeat = createHeartbeat();
    heartbeat.onConnect("a");
    heartbeat.onTick();
    expect(heartbeat.onTick()).toEqual(["a"]);
    expect(heartbeat.onTick()).toEqual([]);
  });
});
