import { hostname } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { ConfigError, DEFAULT_PORT, loadConfig } from "../config.ts";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, hostname: () => "Wahid-MacBook.local" };
});

const rootDir = "/repo";
const noEnv: Record<string, string | undefined> = {};

describe("loadConfig", () => {
  it("defaults to local mode, loopback host and serving the page", () => {
    const config = loadConfig({ env: noEnv, argv: [], rootDir });
    expect(config.mode).toBe("local");
    expect(config.host).toBe("127.0.0.1");
    expect(config.serveWeb).toBe(true);
  });

  it("becomes central mode with --hub, listening on every interface", () => {
    const config = loadConfig({ env: noEnv, argv: ["--hub"], rootDir });
    expect(config.mode).toBe("central");
    expect(config.host).toBe("0.0.0.0");
  });

  it("becomes reporter mode when HUB is set, without serving the page", () => {
    const config = loadConfig({ env: { HUB: "ws://x:4317" }, argv: [], rootDir });
    expect(config.mode).toBe("reporter");
    expect(config.serveWeb).toBe(false);
    expect(config.webRoot).toBe("");
  });

  it("refuses --hub combined with HUB", () => {
    expect(() => loadConfig({ env: { HUB: "ws://x:4317" }, argv: ["--hub"], rootDir })).toThrow(ConfigError);
  });

  it("defaults PORT to 4317 when missing", () => {
    const config = loadConfig({ env: noEnv, argv: [], rootDir });
    expect(config.port).toBe(4317);
    expect(config.port).toBe(DEFAULT_PORT);
  });

  it("defaults PORT to 4317 when set but empty", () => {
    const config = loadConfig({ env: { PORT: "" }, argv: [], rootDir });
    expect(config.port).toBe(4317);
    expect(config.port).toBe(DEFAULT_PORT);
  });

  it("uses PORT when it is a valid number", () => {
    const config = loadConfig({ env: { PORT: "8080" }, argv: [], rootDir });
    expect(config.port).toBe(8080);
  });

  it("refuses a non-numeric PORT", () => {
    expect(() => loadConfig({ env: { PORT: "abc" }, argv: [], rootDir })).toThrow(ConfigError);
  });

  it("refuses a PORT of 0", () => {
    expect(() => loadConfig({ env: { PORT: "0" }, argv: [], rootDir })).toThrow(ConfigError);
  });

  it("refuses a PORT above 65535", () => {
    expect(() => loadConfig({ env: { PORT: "70000" }, argv: [], rootDir })).toThrow(ConfigError);
  });

  it("refuses a HUB value that is not a URL", () => {
    expect(() => loadConfig({ env: { HUB: "not-a-url" }, argv: [], rootDir })).toThrow(ConfigError);
  });

  it("refuses a HUB value with a non-websocket protocol", () => {
    expect(() => loadConfig({ env: { HUB: "http://x" }, argv: [], rootDir })).toThrow(ConfigError);
  });

  it("accepts a wss:// HUB value", () => {
    const config = loadConfig({ env: { HUB: "wss://x:4317" }, argv: [], rootDir });
    expect(config.mode).toBe("reporter");
    expect(config.hubUrl).toBe("wss://x:4317");
  });

  it("uses MACHINE when set", () => {
    const config = loadConfig({ env: { MACHINE: "wahid" }, argv: [], rootDir });
    expect(config.machine).toBe("wahid");
  });

  it("falls back to the lowercase host name without domain when MACHINE is empty", () => {
    const config = loadConfig({ env: { MACHINE: "" }, argv: [], rootDir });
    expect(config.machine).toBe(hostname().split(".")[0].toLowerCase());
    expect(config.machine).toBe("wahid-macbook");
  });
});
