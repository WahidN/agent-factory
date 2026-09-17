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
      messageTimestamps.push(now);
    },

    snapshot(now: number): MetricsSnapshot {
      while (messageTimestamps.length > 0 && now - messageTimestamps[0] > RATE_WINDOW_MS) {
        messageTimestamps.shift();
      }
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
