// Pure counters for /metrics: connected machines, messages per second, and
// the last update and protocol version per machine. No sockets and no clock
// of its own, callers pass `now`, same idea as session-tracker and heartbeat.

const RATE_WINDOW_MS = 10_000;

export type MachineMetrics = {
  machine: string;
  protocol: number;
  lastMessageAt: number;
};

export type MetricsSnapshot = {
  connected: number;
  messagesPerSecond: number;
  machines: MachineMetrics[];
};

export function createMetrics() {
  const machines = new Map<string, { protocol: number; lastMessageAt: number }>();
  const messageTimestamps: number[] = [];

  // Trimming on every message, not only when someone asks for a snapshot: a
  // central runs for weeks and nothing guarantees anyone ever opens /metrics,
  // so the array has to stay bounded by the window on its own.
  function dropOlderThanWindow(now: number) {
    let stale = 0;
    while (stale < messageTimestamps.length && now - messageTimestamps[stale] > RATE_WINDOW_MS) stale++;
    if (stale > 0) messageTimestamps.splice(0, stale);
  }

  return {
    // A machine joined and told us which protocol it speaks.
    join(machine: string, protocol: number, now: number) {
      machines.set(machine, { protocol, lastMessageAt: now });
    },

    leave(machine: string) {
      machines.delete(machine);
    },

    // Call once per relayed message (not the hello itself), so the rate
    // reflects real session traffic.
    message(machine: string, now: number) {
      const entry = machines.get(machine);
      if (entry) entry.lastMessageAt = now;
      dropOlderThanWindow(now);
      messageTimestamps.push(now);
    },

    snapshot(now: number): MetricsSnapshot {
      dropOlderThanWindow(now);
      const messagesPerSecond = messageTimestamps.length / (RATE_WINDOW_MS / 1000);
      return {
        connected: machines.size,
        messagesPerSecond,
        machines: [...machines.entries()]
          .map(([machine, info]) => ({ machine, ...info }))
          .sort((a, b) => a.machine.localeCompare(b.machine)),
      };
    },
  };
}
