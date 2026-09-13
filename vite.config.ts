import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "web",
  server: {
    proxy: {
      "/ws": { target: "ws://127.0.0.1:4317", ws: true },
    },
  },
  test: {
    root: ".",
    include: ["server/tests/**/*.test.ts", "web/tests/**/*.test.ts"],
    passWithNoTests: true,
  },
});
