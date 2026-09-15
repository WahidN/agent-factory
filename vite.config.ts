import { defineConfig } from "vitest/config";

// HUB=ws://host:4317 shows that hub's park instead of the local server's.
const target = process.env.HUB ?? "ws://127.0.0.1:4317";

export default defineConfig({
  root: "web",
  server: {
    proxy: {
      "/ws": { target, ws: true },
    },
  },
  test: {
    root: ".",
    include: ["server/tests/**/*.test.ts", "web/tests/**/*.test.ts"],
    passWithNoTests: true,
  },
});
