import { describe, expect, it } from "vitest";
import { createHeartbeat } from "../heartbeat.ts";

// index.ts calls onTick before it pings, so the first tick counts a miss
// before any ping has gone out. A client that never answers is therefore
// dropped on the third tick: by then it has left the pings of tick one and
// tick two unanswered.

describe("createHeartbeat", () => {
  it("gives back nobody to drop on the first tick", () => {
    const heartbeat = createHeartbeat();
    heartbeat.onConnect("a");
    expect(heartbeat.onTick()).toEqual([]);
  });

  it("drops a client only after it misses two pings in a row", () => {
    const heartbeat = createHeartbeat();
    heartbeat.onConnect("a");
    expect(heartbeat.onTick()).toEqual([]); // no ping sent yet, ping 1 goes out
    expect(heartbeat.onTick()).toEqual([]); // ping 1 unanswered, ping 2 goes out
    expect(heartbeat.onTick()).toEqual(["a"]); // ping 2 unanswered too, drop
  });

  it("a pong resets the missed counter", () => {
    const heartbeat = createHeartbeat();
    heartbeat.onConnect("a");
    heartbeat.onTick();
    heartbeat.onTick(); // ping 1 unanswered
    heartbeat.onPong("a"); // answers ping 2
    expect(heartbeat.onTick()).toEqual([]);
    expect(heartbeat.onTick()).toEqual([]); // ping 3 unanswered
    expect(heartbeat.onTick()).toEqual(["a"]); // ping 4 unanswered too, drop
  });

  it("forgetting a client stops it from ever being reported", () => {
    const heartbeat = createHeartbeat();
    heartbeat.onConnect("a");
    heartbeat.forget("a");
    expect(heartbeat.onTick()).toEqual([]);
    expect(heartbeat.onTick()).toEqual([]);
    expect(heartbeat.onTick()).toEqual([]);
  });

  it("tracks several clients independently", () => {
    const heartbeat = createHeartbeat();
    heartbeat.onConnect("a");
    heartbeat.onConnect("b");
    heartbeat.onTick();
    heartbeat.onTick();
    heartbeat.onPong("b");
    expect(heartbeat.onTick()).toEqual(["a"]); // a missed two pings, b just answered
  });

  it("a dropped client is removed and not reported again", () => {
    const heartbeat = createHeartbeat();
    heartbeat.onConnect("a");
    heartbeat.onTick();
    heartbeat.onTick();
    expect(heartbeat.onTick()).toEqual(["a"]);
    expect(heartbeat.onTick()).toEqual([]);
  });
});
