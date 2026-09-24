// All knowledge of Claude Code's internal file formats lives here.
// Pure functions only, so a format change is a one-file fix with fixture tests.

import type { AgentStatus } from "./types.ts";

export type SessionFile = {
  pid: number;
  sessionId: string;
  cwd: string;
  name: string;
  status: AgentStatus;
  startedAt: number;
};

export type TranscriptEvent =
  | { kind: "tool_start"; id: string; name: string; target: string; at: number }
  | { kind: "tool_end"; id: string; at: number }
  | { kind: "model"; model: string; at: number };

// Placeholder Claude Code writes on messages it made up itself.
const SYNTHETIC_MODEL = "<synthetic>";

const LABEL_MAX = 40;

// "/Volumes/Based/Projects" -> "-Volumes-Based-Projects"
export function projectDirFor(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

export function parseSessionFile(json: string): SessionFile | null {
  const data = parseJson(json);
  if (!data) return null;
  const { pid, sessionId, cwd } = data;
  if (typeof pid !== "number" || typeof sessionId !== "string" || typeof cwd !== "string") {
    return null;
  }
  return {
    pid,
    sessionId,
    cwd,
    name: typeof data.name === "string" && data.name ? data.name : baseName(cwd),
    status: data.status === "busy" ? "busy" : "idle",
    startedAt: typeof data.startedAt === "number" ? data.startedAt : 0,
  };
}

// Parses complete lines. The unfinished last line comes back as `remainder`
// so the caller can prepend it to the next chunk.
export function parseTranscriptChunk(text: string): { entries: TranscriptEvent[]; remainder: string } {
  const lines = text.split("\n");
  const remainder = lines.pop() ?? "";
  const entries: TranscriptEvent[] = [];

  for (const line of lines) {
    const data = parseJson(line);
    const content = data?.message?.content;
    if (!Array.isArray(content)) continue;
    const parsed = Date.parse(data.timestamp);
    const at = Number.isFinite(parsed) ? parsed : 0;

    // Every assistant line names the model that wrote it.
    const model = data.message.model;
    if (data.type === "assistant" && typeof model === "string" && model && model !== SYNTHETIC_MODEL) {
      entries.push({ kind: "model", model, at });
    }

    for (const block of content) {
      if (data.type === "assistant" && block?.type === "tool_use" && typeof block.id === "string") {
        const name = typeof block.name === "string" ? block.name : "unknown";
        entries.push({ kind: "tool_start", id: block.id, name, target: toolTarget(name, block.input), at });
      } else if (data.type === "user" && block?.type === "tool_result" && typeof block.tool_use_id === "string") {
        entries.push({ kind: "tool_end", id: block.tool_use_id, at });
      }
    }
  }

  return { entries, remainder };
}

// When reading from the middle of a file, the first line is usually cut off.
export function dropPartialFirstLine(text: string): string {
  const newline = text.indexOf("\n");
  return newline === -1 ? "" : text.slice(newline + 1);
}

// Short label only. Never returns prompts or file contents.
export function toolTarget(name: string, input: unknown): string {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  switch (name) {
    case "Edit":
    case "Write":
      return typeof args.file_path === "string" ? baseName(args.file_path) : "";
    case "NotebookEdit":
      return typeof args.notebook_path === "string" ? baseName(args.notebook_path) : "";
    case "Bash":
      return shorten(args.command);
    case "Grep":
      return shorten(args.pattern);
    default:
      return "";
  }
}

function shorten(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, LABEL_MAX);
}

export function baseName(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

function parseJson(text: string): any {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}
