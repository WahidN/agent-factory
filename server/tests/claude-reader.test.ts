import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  dropPartialFirstLine,
  parseSessionFile,
  parseSubagentMeta,
  parseTranscriptChunk,
  projectDirFor,
  toolTarget,
} from "../claude-reader.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("projectDirFor", () => {
  it("turns slashes into dashes", () => {
    expect(projectDirFor("/Volumes/Based/Projects")).toBe("-Volumes-Based-Projects");
    expect(projectDirFor("/Volumes/Based/Projects/next-smile-studio-website")).toBe(
      "-Volumes-Based-Projects-next-smile-studio-website",
    );
  });

  it("turns other non letter or digit characters into dashes", () => {
    expect(projectDirFor("/Users/me/.config/my app")).toBe("-Users-me--config-my-app");
  });
});

describe("parseSessionFile", () => {
  it("reads a valid session file", () => {
    expect(parseSessionFile(fixture("session.json"))).toEqual({
      pid: 4242,
      sessionId: "aaaa-1111",
      cwd: "/Users/me/Projects/shop",
      name: "shop-a1",
      status: "busy",
      startedAt: 1789283956886,
    });
  });

  it("rejects a file without sessionId", () => {
    expect(parseSessionFile(fixture("session-missing-fields.json"))).toBeNull();
  });

  it("rejects invalid JSON", () => {
    expect(parseSessionFile(fixture("session-invalid.json"))).toBeNull();
  });

  it("treats unknown status as idle and falls back to folder name", () => {
    const file = parseSessionFile('{"pid":1,"sessionId":"s","cwd":"/a/shop","status":"weird"}');
    expect(file?.status).toBe("idle");
    expect(file?.name).toBe("shop");
  });
});

describe("parseTranscriptChunk", () => {
  it("finds tool starts and ends in order", () => {
    const { entries, remainder } = parseTranscriptChunk(fixture("running-tool.jsonl"));
    expect(remainder).toBe("");
    expect(entries).toEqual([
      { kind: "model", model: "claude-opus-5", at: Date.parse("2026-09-13T10:00:01.000Z") },
      { kind: "tool_start", id: "toolu_1", name: "Read", target: "", at: Date.parse("2026-09-13T10:00:01.000Z") },
      { kind: "tool_end", id: "toolu_1", at: Date.parse("2026-09-13T10:00:02.000Z") },
      { kind: "model", model: "claude-opus-5", at: Date.parse("2026-09-13T10:00:03.000Z") },
      {
        kind: "tool_start",
        id: "toolu_2",
        name: "Bash",
        target: "npm run test -- --reporter verbose --run",
        at: Date.parse("2026-09-13T10:00:03.000Z"),
      },
    ]);
  });

  it("sees a finished tool", () => {
    const kinds = parseTranscriptChunk(fixture("finished-tool.jsonl")).entries.map((e) => e.kind);
    expect(kinds).toEqual(["model", "tool_start", "tool_end"]);
  });

  it("names the model of every assistant line except synthetic ones", () => {
    const models = parseTranscriptChunk(fixture("finished-tool.jsonl"))
      .entries.filter((e) => e.kind === "model")
      .map((e) => e.model);
    expect(models).toEqual(["claude-sonnet-5"]); // the last line says "<synthetic>"
  });

  it("carries a half-written last line as remainder and completes it later", () => {
    const text = fixture("half-written.jsonl");
    const first = parseTranscriptChunk(text);
    expect(first.entries.map((e) => e.kind)).toEqual(["model", "tool_start"]);
    expect(first.remainder.startsWith('{"type":"user"')).toBe(true);

    const rest = 'sult","tool_use_id":"toolu_1","content":"x"}]}}\n';
    const second = parseTranscriptChunk(first.remainder + rest);
    expect(second.entries).toEqual([{ kind: "tool_end", id: "toolu_1", at: Date.parse("2026-09-13T10:00:02.000Z") }]);
    expect(second.remainder).toBe("");
  });

  it("skips unknown and broken lines", () => {
    const { entries } = parseTranscriptChunk(fixture("unknown-lines.jsonl"));
    expect(entries).toEqual([
      { kind: "model", model: "claude-fable-5-1", at: Date.parse("2026-09-13T10:00:02.000Z") },
      {
        kind: "tool_start",
        id: "toolu_9",
        name: "mcp__sentry__search",
        target: "",
        at: Date.parse("2026-09-13T10:00:02.000Z"),
      },
    ]);
  });

  it("reads subagent transcripts the same way", () => {
    const { entries } = parseTranscriptChunk(fixture("subagent.jsonl"));
    expect(entries).toEqual([
      { kind: "model", model: "claude-sonnet-5", at: Date.parse("2026-09-13T10:05:01.000Z") },
      { kind: "tool_start", id: "toolu_s1", name: "Glob", target: "", at: Date.parse("2026-09-13T10:05:01.000Z") },
    ]);
  });

  it("never leaks prompts, thinking, or tool results", () => {
    const json = JSON.stringify(parseTranscriptChunk(fixture("running-tool.jsonl")).entries);
    expect(json).not.toContain("secret");
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("private thoughts");
  });
});

describe("dropPartialFirstLine", () => {
  it("drops text up to the first newline", () => {
    expect(dropPartialFirstLine('ol":1}\n{"a":2}\n')).toBe('{"a":2}\n');
    expect(dropPartialFirstLine("no newline")).toBe("");
  });
});

describe("toolTarget", () => {
  it("uses the base name for file edits", () => {
    expect(toolTarget("Edit", { file_path: "/a/b/page.tsx", new_string: "file contents" })).toBe("page.tsx");
    expect(toolTarget("Write", { file_path: "/a/b/new.ts", content: "file contents" })).toBe("new.ts");
    expect(toolTarget("NotebookEdit", { notebook_path: "/a/nb.ipynb" })).toBe("nb.ipynb");
  });

  it("truncates commands and patterns to 40 characters", () => {
    const long = "x".repeat(100);
    expect(toolTarget("Bash", { command: long })).toHaveLength(40);
    expect(toolTarget("Grep", { pattern: long })).toHaveLength(40);
    expect(toolTarget("Bash", { command: "npm test" })).toBe("npm test");
  });

  it("flattens multi-line commands", () => {
    expect(toolTarget("Bash", { command: "cd app &&\n  npm test" })).toBe("cd app && npm test");
  });

  it("returns empty for other tools and bad input", () => {
    expect(toolTarget("Read", { file_path: "/a/secret.txt" })).toBe("");
    expect(toolTarget("WebFetch", { url: "https://x", prompt: "summarize" })).toBe("");
    expect(toolTarget("Edit", undefined)).toBe("");
    expect(toolTarget("Bash", { command: 42 })).toBe("");
  });
});

describe("parseSubagentMeta", () => {
  it("reads a valid meta file", () => {
    expect(parseSubagentMeta(fixture("subagent.meta.json"))).toEqual({
      name: "code-review",
      agentType: "general-purpose",
      description: "/code-review 6",
      model: "",
    });
  });

  it("reads the model alias when the file has one", () => {
    const meta = parseSubagentMeta('{"agentType":"general-purpose","description":"Review","model":"sonnet"}');
    expect(meta?.model).toBe("sonnet");
  });

  it("rejects an invalid meta file", () => {
    expect(parseSubagentMeta(fixture("subagent-invalid.meta.json"))).toBeNull();
  });
});
