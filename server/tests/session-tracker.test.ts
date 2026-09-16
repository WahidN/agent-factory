import { describe, expect, it } from "vitest";
import type { SessionFile, TranscriptEvent } from "../claude-reader.ts";
import { SessionTracker, SESSION_BUSY_MS, SUBAGENT_BUSY_MS, SUBAGENT_REMOVE_MS } from "../session-tracker.ts";
import type { ServerMessage, SessionState } from "../types.ts";

const file: SessionFile = {
  pid: 1,
  sessionId: "s1",
  cwd: "/Users/me/shop",
  name: "shop-a1",
  status: "busy",
  startedAt: 100,
};

const start = (id: string, name: string, target = ""): TranscriptEvent => ({
  kind: "tool_start",
  id,
  name,
  target,
  at: 0,
});
const end = (id: string): TranscriptEvent => ({ kind: "tool_end", id, at: 0 });
const model = (id: string): TranscriptEvent => ({ kind: "model", model: id, at: 0 });
const review = { name: "review", model: "" };

function setup() {
  const messages: ServerMessage[] = [];
  const tracker = new SessionTracker((m) => messages.push(m), "dennis");
  const latest = (): SessionState => tracker.snapshot(now.value)[0];
  const now = { value: 1_000_000 };
  tracker.upsertSession(file, now.value);
  return { tracker, messages, latest, now };
}

describe("session state shape", () => {
  it("has exactly the seven wire fields", () => {
    const { latest } = setup();
    expect(Object.keys(latest()).sort()).toEqual(
      ["id", "model", "project", "startedAt", "status", "subagents", "user"].sort(),
    );
  });

  it("subagents is a count, not a list", () => {
    const { tracker, latest, now } = setup();
    expect(latest().subagents).toBe(0);
    tracker.applySubagentEvents("s1", "agent-x", review, [], now.value, now.value);
    expect(latest().subagents).toBe(1);
    tracker.applySubagentEvents("s1", "agent-y", review, [], now.value, now.value);
    expect(latest().subagents).toBe(2);
  });
});

describe("session tool state", () => {
  it("tracks the current tool through start, start, end, end (busy while any is open)", () => {
    const { tracker, latest, now } = setup();
    // The file this session comes from is idle here, so status alone reveals
    // whether an open tool is what keeps it busy.
    tracker.upsertSession({ ...file, status: "idle" }, now.value);
    expect(latest().status).toBe("idle");

    tracker.applySessionEvents("s1", [start("a", "Read")], now.value, now.value);
    expect(latest().status).toBe("busy");

    tracker.applySessionEvents("s1", [end("a")], now.value, now.value);
    now.value += SESSION_BUSY_MS; // past the recent-write window too
    expect(latest().status).toBe("idle");
  });

  it("takes the project from the working folder, never the full path", () => {
    const { tracker, latest, now } = setup();
    tracker.upsertSession({ ...file, cwd: "/Users/me/Projecten/agent-factory/" }, now.value);
    expect(latest().project).toBe("agent-factory");
    expect(JSON.stringify(latest())).not.toContain("/Users");

    tracker.upsertSession({ ...file, cwd: "/" }, now.value);
    expect(latest().project).toBe("/");
  });

  it("stamps the configured user on the session", () => {
    const { latest } = setup();
    expect(latest().user).toBe("dennis");
  });

  it("ignores events for unknown sessions", () => {
    const { tracker, messages, now } = setup();
    tracker.applySessionEvents("nope", [start("a", "Read")], now.value, now.value);
    expect(messages).toHaveLength(1);
  });

  it("keeps the latest model the transcript names", () => {
    const { tracker, latest, messages, now } = setup();
    expect(latest().model).toBe("");

    tracker.applySessionEvents("s1", [model("claude-sonnet-5"), start("a", "Read")], now.value, now.value);
    expect(latest().model).toBe("claude-sonnet-5");

    const before = messages.length;
    tracker.applySessionEvents("s1", [model("claude-opus-5")], now.value, now.value);
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

describe("busy from write activity", () => {
  it("an idle file plus a recent write is busy", () => {
    const { tracker, latest, now } = setup();
    tracker.upsertSession({ ...file, status: "idle" }, now.value);
    tracker.applySessionEvents("s1", [], now.value, now.value);
    expect(latest().status).toBe("busy");
  });

  it("an idle file plus a write older than SESSION_BUSY_MS is idle", () => {
    const { tracker, latest, now } = setup();
    tracker.upsertSession({ ...file, status: "idle" }, now.value);
    const writtenAt = now.value;
    tracker.applySessionEvents("s1", [], writtenAt, now.value);
    now.value = writtenAt + SESSION_BUSY_MS;
    expect(latest().status).toBe("idle");
  });

  it("an open tool is busy no matter how long ago the write was", () => {
    const { tracker, latest, now } = setup();
    tracker.upsertSession({ ...file, status: "idle" }, now.value);
    const writtenAt = now.value;
    tracker.applySessionEvents("s1", [start("a", "Read")], writtenAt, now.value);
    now.value = writtenAt + SESSION_BUSY_MS * 10;
    expect(latest().status).toBe("busy");
  });

  it("a busy file stays busy even with no write activity at all", () => {
    const { latest, now } = setup();
    now.value += SESSION_BUSY_MS * 10;
    expect(latest().status).toBe("busy");
  });
});

describe("subagents", () => {
  it("is counted while written in the last 5 seconds, then removed once quiet and idle", () => {
    const { tracker, latest, now } = setup();
    tracker.applySubagentEvents("s1", "agent-x", { name: "code-review", model: "" }, [], now.value, now.value);
    expect(latest().subagents).toBe(1);

    now.value += SUBAGENT_BUSY_MS - 1;
    tracker.tick(now.value);
    expect(latest().subagents).toBe(1);

    now.value += SUBAGENT_REMOVE_MS;
    tracker.tick(now.value);
    expect(latest().subagents).toBe(0);
  });

  it("keeps a subagent with a running tool alive however long it is quiet", () => {
    const { tracker, latest, now } = setup();
    tracker.applySubagentEvents("s1", "agent-x", review, [start("t", "Grep", "foo")], now.value, now.value);
    now.value += SUBAGENT_REMOVE_MS * 2;
    tracker.tick(now.value);
    expect(latest().subagents).toBe(1);
  });

  it("is removed after 60 seconds quiet with no running tool", () => {
    const { tracker, latest, now } = setup();
    const written = now.value;
    tracker.applySubagentEvents("s1", "agent-x", review, [start("t", "Grep"), end("t")], written, now.value);

    now.value = written + SUBAGENT_REMOVE_MS - 1;
    tracker.tick(now.value);
    expect(latest().subagents).toBe(1);

    now.value = written + SUBAGENT_REMOVE_MS;
    tracker.tick(now.value);
    expect(latest().subagents).toBe(0);
  });

  it("a new write resets the quiet timer", () => {
    const { tracker, latest, now } = setup();
    tracker.applySubagentEvents("s1", "agent-x", review, [], now.value, now.value);
    now.value += SUBAGENT_REMOVE_MS - 1000;
    tracker.applySubagentEvents("s1", "agent-x", review, [], now.value, now.value);
    now.value += SUBAGENT_REMOVE_MS - 1000;
    tracker.tick(now.value);
    expect(latest().subagents).toBe(1);
  });
});

describe("change notices", () => {
  it("sends one notice for repeated identical updates", () => {
    const { tracker, messages, now } = setup();
    expect(messages).toHaveLength(1);

    tracker.upsertSession(file, now.value);
    tracker.upsertSession(file, now.value);
    tracker.applySessionEvents("s1", [], now.value, now.value);
    tracker.tick(now.value);
    expect(messages).toHaveLength(1);

    tracker.applySessionEvents("s1", [model("claude-sonnet-5")], now.value, now.value);
    tracker.applySessionEvents("s1", [], now.value, now.value);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ type: "session-update", session: { model: "claude-sonnet-5" } });
  });

  it("a tool that starts and ends in one read still surfaces the busy blip", () => {
    const { tracker, messages, now } = setup();
    tracker.upsertSession({ ...file, status: "idle" }, now.value);
    const before = messages.length;
    const oldWrite = now.value - SESSION_BUSY_MS; // outside the recent-write window
    tracker.applySessionEvents("s1", [start("a", "Read"), end("a")], oldWrite, now.value);
    const statuses = messages.slice(before).map((m) => (m.type === "session-update" ? m.session.status : "x"));
    expect(statuses).toEqual(["busy", "idle"]);
  });

  it("sends a notice when a session turns idle through time alone", () => {
    const { tracker, messages, now } = setup();
    tracker.upsertSession({ ...file, status: "idle" }, now.value);
    tracker.applySessionEvents("s1", [], now.value, now.value);
    const before = messages.length;
    now.value += SESSION_BUSY_MS;
    tracker.tick(now.value);
    tracker.tick(now.value);
    expect(messages.length).toBe(before + 1);
  });
});
