import { describe, expect, it } from "vitest";
import type { SessionFile, TranscriptEvent } from "../claude-reader.ts";
import { SessionTracker, SUBAGENT_BUSY_MS, SUBAGENT_REMOVE_MS } from "../session-tracker.ts";
import type { ServerMessage, SessionState } from "../types.ts";

const file: SessionFile = {
  pid: 1,
  sessionId: "s1",
  cwd: "/Users/me/shop",
  name: "shop-a1",
  status: "busy",
  startedAt: 100,
};

const start = (id: string, name: string, target = ""): TranscriptEvent => ({ kind: "tool_start", id, name, target, at: 0 });
const end = (id: string): TranscriptEvent => ({ kind: "tool_end", id, at: 0 });
const model = (id: string): TranscriptEvent => ({ kind: "model", model: id, at: 0 });
const review = { name: "review", model: "" };

function setup() {
  const messages: ServerMessage[] = [];
  const tracker = new SessionTracker((m) => messages.push(m), "mac-a");
  const latest = (): SessionState => tracker.snapshot(now.value)[0];
  const now = { value: 1_000_000 };
  tracker.upsertSession(file, now.value);
  return { tracker, messages, latest, now };
}

describe("session tool state", () => {
  it("tracks the current tool through start, start, end, end", () => {
    const { tracker, latest, now } = setup();
    expect(latest().currentTool).toBeNull();

    tracker.applySessionEvents("s1", [start("a", "Read")], now.value);
    expect(latest().currentTool).toEqual({ name: "Read", target: "" });

    tracker.applySessionEvents("s1", [start("b", "Bash", "npm test")], now.value);
    expect(latest().currentTool).toEqual({ name: "Bash", target: "npm test" });

    tracker.applySessionEvents("s1", [end("b")], now.value);
    expect(latest().currentTool).toEqual({ name: "Read", target: "" });

    tracker.applySessionEvents("s1", [end("a")], now.value);
    expect(latest().currentTool).toBeNull();
  });

  it("takes status and name from the session file", () => {
    const { tracker, latest, now } = setup();
    expect(latest().status).toBe("busy");
    tracker.upsertSession({ ...file, status: "idle", name: "renamed" }, now.value);
    expect(latest()).toMatchObject({ status: "idle", name: "renamed", folder: "shop", startedAt: 100 });
  });

  it("sends the folder name, never the full path", () => {
    const { tracker, latest, now } = setup();
    tracker.upsertSession({ ...file, cwd: "/Users/me/Projecten/agent-factory/" }, now.value);
    expect(latest().folder).toBe("agent-factory");
    expect(JSON.stringify(latest())).not.toContain("/Users");

    tracker.upsertSession({ ...file, cwd: "/" }, now.value);
    expect(latest().folder).toBe("/");
  });

  it("stamps the machine name on the session and its subagents", () => {
    const { tracker, latest, now } = setup();
    tracker.applySubagentEvents("s1", "agent-x", review, [], now.value, now.value);
    expect(latest().machine).toBe("mac-a");
    expect(latest().subagents[0].machine).toBe("mac-a");
  });

  it("ignores events for unknown sessions", () => {
    const { tracker, messages, now } = setup();
    tracker.applySessionEvents("nope", [start("a", "Read")], now.value);
    expect(messages).toHaveLength(1);
  });

  it("keeps the latest model the transcript names", () => {
    const { tracker, latest, messages, now } = setup();
    expect(latest().model).toBe("");

    tracker.applySessionEvents("s1", [model("claude-sonnet-5"), start("a", "Read")], now.value);
    expect(latest().model).toBe("claude-sonnet-5");

    const before = messages.length;
    tracker.applySessionEvents("s1", [model("claude-opus-5")], now.value);
    expect(latest().model).toBe("claude-opus-5");
    expect(messages.length).toBe(before + 1);
    expect(messages.at(-1)).toMatchObject({ type: "session-update", session: { model: "claude-opus-5" } });
  });

  it("announces removal", () => {
    const { tracker, messages } = setup();
    tracker.removeSession("s1");
    expect(messages.at(-1)).toEqual({ type: "session-removed", id: "s1" });
    expect(tracker.snapshot(0)).toEqual([]);
  });
});

describe("subagents", () => {
  it("is busy while written in the last 5 seconds, then idle", () => {
    const { tracker, latest, now } = setup();
    tracker.applySubagentEvents("s1", "agent-x", { name: "code-review", model: "" }, [], now.value, now.value);
    expect(latest().subagents[0]).toMatchObject({ id: "agent-x", name: "code-review", status: "busy", folder: "shop", machine: "mac-a" });

    now.value += SUBAGENT_BUSY_MS - 1;
    tracker.tick(now.value);
    expect(latest().subagents[0].status).toBe("busy");

    now.value += 1;
    tracker.tick(now.value);
    expect(latest().subagents[0].status).toBe("idle");
  });

  it("stays busy while a tool is running, however long it is quiet", () => {
    const { tracker, latest, now } = setup();
    tracker.applySubagentEvents("s1", "agent-x", review, [start("t", "Grep", "foo")], now.value, now.value);
    now.value += SUBAGENT_REMOVE_MS * 2;
    tracker.tick(now.value);
    expect(latest().subagents[0]).toMatchObject({ status: "busy", currentTool: { name: "Grep", target: "foo" } });
  });

  it("is removed after 60 seconds quiet with no running tool", () => {
    const { tracker, latest, now } = setup();
    const written = now.value;
    tracker.applySubagentEvents("s1", "agent-x", review, [start("t", "Grep"), end("t")], written, now.value);

    now.value = written + SUBAGENT_REMOVE_MS - 1;
    tracker.tick(now.value);
    expect(latest().subagents).toHaveLength(1);

    now.value = written + SUBAGENT_REMOVE_MS;
    tracker.tick(now.value);
    expect(latest().subagents).toHaveLength(0);
  });

  it("a new write resets the quiet timer", () => {
    const { tracker, latest, now } = setup();
    tracker.applySubagentEvents("s1", "agent-x", review, [], now.value, now.value);
    now.value += SUBAGENT_REMOVE_MS - 1000;
    tracker.applySubagentEvents("s1", "agent-x", review, [], now.value, now.value);
    now.value += SUBAGENT_REMOVE_MS - 1000;
    tracker.tick(now.value);
    expect(latest().subagents).toHaveLength(1);
  });
});

describe("subagent model", () => {
  it("shows the meta alias until the transcript names a model", () => {
    const { tracker, latest, now } = setup();
    tracker.applySubagentEvents("s1", "agent-x", { name: "review", model: "sonnet" }, [], now.value, now.value);
    expect(latest().subagents[0].model).toBe("sonnet");

    tracker.applySubagentEvents("s1", "agent-x", { name: "review", model: "sonnet" }, [model("claude-sonnet-5")], now.value, now.value);
    expect(latest().subagents[0].model).toBe("claude-sonnet-5");
  });

  it("is empty without an alias or a transcript model", () => {
    const { tracker, latest, now } = setup();
    tracker.applySubagentEvents("s1", "agent-x", review, [], now.value, now.value);
    expect(latest().subagents[0].model).toBe("");
  });
});

describe("change notices", () => {
  it("sends one notice for repeated identical updates", () => {
    const { tracker, messages, now } = setup();
    expect(messages).toHaveLength(1);

    tracker.upsertSession(file, now.value);
    tracker.upsertSession(file, now.value);
    tracker.applySessionEvents("s1", [], now.value);
    tracker.tick(now.value);
    expect(messages).toHaveLength(1);

    tracker.applySessionEvents("s1", [start("a", "Read")], now.value);
    tracker.applySessionEvents("s1", [], now.value);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ type: "session-update", session: { currentTool: { name: "Read" } } });
  });

  it("a tool that starts and ends in one read still sends both states", () => {
    const { tracker, messages, now } = setup();
    tracker.applySessionEvents("s1", [start("a", "Read"), end("a")], now.value);
    const tools = messages.slice(1).map((m) => (m.type === "session-update" ? m.session.currentTool?.name : "x"));
    expect(tools).toEqual(["Read", undefined]);
  });

  it("sends a notice when a subagent turns idle through time alone", () => {
    const { tracker, messages, now } = setup();
    tracker.applySubagentEvents("s1", "agent-x", review, [], now.value, now.value);
    const before = messages.length;
    now.value += SUBAGENT_BUSY_MS;
    tracker.tick(now.value);
    tracker.tick(now.value);
    expect(messages.length).toBe(before + 1);
  });
});
