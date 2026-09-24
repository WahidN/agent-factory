// Every environment variable and command line flag in one place, so a bad
// setting fails at start with a readable line instead of halfway through a
// file watcher. Pure: takes the environment, returns a value, throws on
// nonsense. Nothing here touches the disk or the network.

import { hostname, userInfo } from "node:os";

// `central`  accepts reporters on /relay and serves the page to the office.
// `reporter` reads this Mac and relays to a central, nothing listens.
// `local`    the default: localhost only, own sessions only.
export type Mode = "central" | "reporter" | "local";

export type Config = {
  mode: Mode;
  host: string;
  port: number;
  /** Where this machine relays to, empty unless mode is `reporter`. */
  hubUrl: string;
  /** Short name this machine reports itself as. */
  machine: string;
  /** Absolute path to the built page. Empty when nothing is served. */
  webRoot: string;
  /** False in `reporter` mode: no HTTP server, no static files. */
  serveWeb: boolean;
  /** Who runs the sessions on this machine, from USER in the environment. */
  user: string;
  /** Guard rail token, checked by a central; empty means it accepts everyone. */
  token: string;
};

export const DEFAULT_PORT = 4317;

export class ConfigError extends Error {}

type Input = {
  env: Record<string, string | undefined>;
  argv: string[];
  /** Absolute path of the repository root, used to find the built page. */
  rootDir: string;
};

export function loadConfig({ env, argv, rootDir }: Input): Config {
  const mode = modeFrom(env, argv);
  const port = portFrom(env.PORT);
  const hubUrl = mode === "reporter" ? requireHubUrl(env.HUB) : "";

  return {
    mode,
    // A central listens on every interface so the office can reach it. The
    // other two modes stay on loopback, which is what makes "nothing leaves
    // the network" true by default rather than by configuration.
    host: mode === "central" ? "0.0.0.0" : "127.0.0.1",
    port,
    hubUrl,
    machine: machineFrom(env.MACHINE),
    webRoot: mode === "reporter" ? "" : `${rootDir}/web/dist`,
    serveWeb: mode !== "reporter",
    user: userFrom(env.USER),
    token: (env.FACTORY_TOKEN ?? "").trim(),
  };
}

function modeFrom(env: Record<string, string | undefined>, argv: string[]): Mode {
  const central = argv.includes("--hub") || argv.includes("--central");
  const relaying = Boolean(env.HUB?.trim());
  if (central && relaying) {
    throw new ConfigError("Started as a central and with HUB set. Pick one: drop --hub, or unset HUB.");
  }
  if (central) return "central";
  if (relaying) return "reporter";
  return "local";
}

function portFrom(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`PORT must be a whole number between 1 and 65535, got "${raw}".`);
  }
  return port;
}

function requireHubUrl(raw: string | undefined): string {
  const value = raw?.trim() ?? "";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError(`HUB must be a URL like ws://agentfactory.local:${DEFAULT_PORT}, got "${value}".`);
  }
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new ConfigError(`HUB must start with ws:// or wss://, got "${value}".`);
  }
  return value;
}

function machineFrom(raw: string | undefined): string {
  const given = raw?.trim();
  if (given) return given;
  const fallback = hostname().split(".")[0].toLowerCase();
  if (!fallback) throw new ConfigError("Could not read a host name. Set MACHINE to name this machine.");
  return fallback;
}

function userFrom(raw: string | undefined): string {
  const given = raw?.trim();
  if (given) return given;
  let fallback = "";
  try {
    fallback = userInfo().username?.trim() ?? "";
  } catch {
    fallback = "";
  }
  if (!fallback) throw new ConfigError("Could not read a user name. Set USER to identify this machine's sessions.");
  return fallback;
}
