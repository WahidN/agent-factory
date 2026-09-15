import { defineConfig } from "vitest/config";

// HUB=ws://host:4317 shows that hub's park instead of the local server's.
const target = process.env.HUB ?? "ws://127.0.0.1:4317";

export default defineConfig({
  root: "web",
  server: {
    // Running locally through portless (https://agent-factory.local).
    allowedHosts: ["agent-factory.local"],
    proxy: {
      "/ws": { target, ws: true },
    },
  },
  test: {
    root: ".",
    include: ["server/tests/**/*.test.ts", "web/tests/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "cobertura"],
      reportsDirectory: "coverage",
      include: [
        "server/**/*.ts",
        "web/plots.ts",
        "web/park-layout.ts",
        "web/activity.ts",
        "web/model-tier.ts",
        "web/sign-text.ts",
        "web/static-builder.ts",
        "web/worker-logic.ts",
        "web/traffic-logic.ts",
      ],
      exclude: ["server/tests/**", "web/tests/**"],
    },
  },
});
