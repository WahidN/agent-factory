// Which sockets to drop, decided without touching a socket. index.ts pings
// every client on a tick and calls onPong when one answers; this module only
// counts misses, so the decision can be tested with a fake clock instead of
// real sockets.

export type Heartbeat<T> = {
  onConnect(client: T): void;
  onPong(client: T): void;
  forget(client: T): void;
  // Call once per tick, before pinging everyone still tracked. The first tick
  // after a connect counts a miss before any ping went out, so a client is
  // dropped once the count passes two: it left two pings in a row unanswered.
  // Returns the clients to terminate; those clients stop being tracked.
  onTick(): T[];
};

export function createHeartbeat<T>(): Heartbeat<T> {
  const missed = new Map<T, number>();

  return {
    onConnect(client) {
      missed.set(client, 0);
    },
    onPong(client) {
      if (missed.has(client)) missed.set(client, 0);
    },
    forget(client) {
      missed.delete(client);
    },
    onTick() {
      const dead: T[] = [];
      for (const [client, count] of missed) {
        const next = count + 1;
        if (next > 2) {
          dead.push(client);
          missed.delete(client);
        } else {
          missed.set(client, next);
        }
      }
      return dead;
    },
  };
}
