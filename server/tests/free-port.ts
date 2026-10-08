import { createServer } from "node:net";

// A port the OS just handed out, for a test that spawns the server on it. A
// random pick from a fixed range collided between test files running at the
// same time; asking for port 0 cannot. The port is free again when this
// resolves, so another process could still take it first, but that window
// is a few milliseconds instead of the whole run.
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}
