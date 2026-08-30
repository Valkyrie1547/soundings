import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptTurn } from "@/db/schema";
import { interviewGuideFor } from "@/config/study";

/**
 * A thenable query builder. Every method returns the same object. An
 * `await` resolves with the next queued result. This is enough for the
 * select, update, and insert chains that the module builds.
 */
const results: unknown[][] = [];
const chain: Record<string, unknown> = {};
const CHAIN_METHODS = ["select", "from", "where", "orderBy", "update", "set", "insert", "values", "onConflictDoNothing", "returning"];
for (const m of CHAIN_METHODS) chain[m] = vi.fn(() => chain);
chain.then = (resolve: (v: unknown) => void) => resolve(results.shift() ?? []);

vi.mock("@/db", () => ({ db: () => chain }));
vi.mock("@/lib/elevenlabs", () => ({ elevenlabs: vi.fn(), agentId: vi.fn() }));

import { endInterviewSession, type BackstopDeps } from "./persist";

const RID = "3b241101-e2bb-4255-8caf-4136c566a962";
const SESSION = "9f1c2d3e-4b5a-4c6d-8e7f-a0b1c2d3e4f5";
const CONVO = "conv_1";
const guide = interviewGuideFor("bmw_customer");
const text = (id: string) => guide.find((q) => q.id === id)!.text;

function row(questionId: string) {
  return { questionId, summary: "s", source: "tool" as const };
}

function turns(pairs: [TranscriptTurn["role"], string][]): TranscriptTurn[] {
  return pairs.map(([role, message], i) => ({ role, message, timeInCallSecs: i }));
}

function segment(conversationId: string, t: TranscriptTurn[] | null) {
  return { attemptNo: 1, startedAt: "2026-08-29T00:00:00.000Z", endReason: null, conversationId, turns: t, summary: null };
}

const allButQ6 = guide.filter((q) => q.required && q.id !== "q6").map((q) => row(q.id));

function deps(over: Partial<BackstopDeps> = {}): BackstopDeps {
  return { loadTranscript: vi.fn().mockResolvedValue([]), insert: vi.fn().mockResolvedValue(undefined), ...over };
}

beforeEach(() => {
  results.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("endInterviewSession with the transcript backstop", () => {
  it("inserts only the candidate id, never an id that is already present, then completes", async () => {
    const t = turns([
      ["agent", text("q5")],
      ["user", "The handling and the seats, mostly."],
      ["agent", text("q6")],
      ["user", "Yes, the infotainment froze twice last winter."],
      ["agent", text("q7")],
    ]);
    const d = deps({ loadTranscript: vi.fn().mockResolvedValue([segment(CONVO, t)]) });
    results.push([], allButQ6, allButQ6, [...allButQ6, { questionId: "q6", summary: "x", source: "transcript" }], []);

    const out = await endInterviewSession(RID, "bmw_customer", SESSION, CONVO, "completed", d);

    expect(d.insert).toHaveBeenCalledTimes(1);
    expect(d.insert).toHaveBeenCalledWith(RID, "q6", "Yes, the infotainment froze twice last winter.");
    expect(out.backstop).toEqual(["q6"]);
    expect(out.complete).toBe(true);
    expect(out.progress.map((p) => p.questionId)).toContain("q6");
  });

  it("does not run when the gate is already complete", async () => {
    const d = deps();
    results.push([], [...allButQ6, row("q6")], []);
    const out = await endInterviewSession(RID, "bmw_customer", SESSION, CONVO, "completed", d);
    expect(d.loadTranscript).not.toHaveBeenCalled();
    expect(out).toMatchObject({ complete: true, backstop: [] });
  });

  it("scans only the segment that just ended", async () => {
    const t = turns([["agent", text("q6")], ["user", "Yes, a rattle from the dashboard that never went away."]]);
    const d = deps({ loadTranscript: vi.fn().mockResolvedValue([segment("conv_other", t), segment(CONVO, null)]) });
    results.push([], allButQ6, allButQ6);
    const out = await endInterviewSession(RID, "bmw_customer", SESSION, CONVO, "completed", d);
    expect(d.insert).not.toHaveBeenCalled();
    expect(out).toMatchObject({ complete: false, backstop: [] });
  });

  it("returns the original gate result when the transcript fetch throws", async () => {
    const d = deps({ loadTranscript: vi.fn().mockRejectedValue(new Error("ElevenLabs down")) });
    results.push([], allButQ6, allButQ6);
    const out = await endInterviewSession(RID, "bmw_customer", SESSION, CONVO, "completed", d);
    expect(out).toMatchObject({ complete: false, backstop: [] });
    expect(out.progress).toHaveLength(allButQ6.length);
  });

  it("skips the backstop when there is no conversation id", async () => {
    const d = deps();
    results.push([], allButQ6);
    const out = await endInterviewSession(RID, "bmw_customer", SESSION, null, "dropped", d);
    expect(d.loadTranscript).not.toHaveBeenCalled();
    expect(out.backstop).toEqual([]);
  });
});
