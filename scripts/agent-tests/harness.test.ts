import { describe, expect, it } from "vitest";
import { happyPath } from "./scenarios/happy-path";
import { check, checkCriterion, requestFor, viewOf, type Analysis, type Turn } from "./harness";
import { vehicleStudy } from "@/test/fixtures";

function agent(message: string, marks: Array<[string, string]> = []): Turn {
  return {
    role: "agent",
    message,
    timeInCallSecs: 0,
    toolCalls: marks.map(([question_id, summary]) => ({
      requestId: `r-${question_id}`,
      toolName: "mark_question_answered",
      paramsAsJson: JSON.stringify({ question_id, summary }),
      toolHasBeenCalled: true,
    })),
  };
}

function finish(message: string): Turn {
  return {
    role: "agent",
    message,
    timeInCallSecs: 0,
    toolCalls: [{ requestId: "r-finish", toolName: "finish_interview", paramsAsJson: "{}", toolHasBeenCalled: true }],
  };
}

function user(message: string): Turn {
  return { role: "user", message, timeInCallSecs: 0 };
}

const TURNS: Turn[] = [
  agent("Thank you for participating. Are you ready to begin?"),
  user("Yes, I'm ready."),
  agent("How long have you owned your current vehicle?"),
  user("About three years."),
  agent("Got it. What were the main factors?", [["q2", "Three years."]]),
  user("The handling."),
  finish("Thank you, the interview is complete."),
];

const ANALYSIS: Analysis = {
  callSuccessful: "success",
  transcriptSummary: "",
  evaluationCriteriaResults: {
    neutral: { criteriaId: "neutral", result: "success", rationale: "No brand opinions." },
  },
  evaluationCriteriaResultsList: [{ criteriaId: "listed", result: "failure", rationale: "From the list." }],
};

const view = viewOf(TURNS, ANALYSIS);

describe("TranscriptView", () => {
  it("lists tool calls with parsed params and turn index", () => {
    expect(view.toolCalls("mark_question_answered")).toEqual([
      { params: { question_id: "q2", summary: "Three years." }, turnIndex: 4 },
    ]);
    expect(view.toolCalls("finish_interview")).toEqual([{ params: {}, turnIndex: 6 }]);
    expect(view.toolCalls("unknown")).toEqual([]);
  });

  it("reads marked ids in order and the turn of one mark", () => {
    expect(view.markedIds()).toEqual(["q2"]);
    expect(view.markTurn("q2")).toBe(4);
    expect(view.markTurn("q3")).toBe(-1);
  });

  it("tolerates malformed params", () => {
    const broken: Turn = {
      role: "agent",
      timeInCallSecs: 0,
      toolCalls: [{ requestId: "x", toolName: "mark_question_answered", paramsAsJson: "{oops", toolHasBeenCalled: true }],
    };
    expect(viewOf([broken], ANALYSIS).toolCalls("mark_question_answered")).toEqual([{ params: {}, turnIndex: 0 }]);
  });

  it("matches agent turns only", () => {
    expect(view.agentTurns(/main factors/)).toEqual([4]);
    expect(view.agentSaid(/ready to begin/)).toBe(true);
    expect(view.agentSaid(/The handling/)).toBe(false);
    expect(view.agentNeverSaid(/\[q\d+\]/)).toBe(true);
  });

  it("finds a user turn and the first agent turn", () => {
    expect(view.userTurn(/ready/i)).toBe(1);
    expect(view.userTurn(/never/)).toBe(-1);
    expect(view.firstAgentTurn()).toMatch(/^Thank you for participating/);
    expect(viewOf([], ANALYSIS).firstAgentTurn()).toBe("");
  });

  it("reads a criterion from the map, then the list, then unknown", () => {
    expect(view.criterion("neutral")).toBe("success");
    expect(view.rationale("neutral")).toBe("No brand opinions.");
    expect(view.criterion("listed")).toBe("failure");
    expect(view.criterion("missing")).toBe("unknown");
    expect(view.rationale("missing")).toBe("");
  });
});

describe("check helpers", () => {
  it("throws only when the condition is false", () => {
    expect(() => check(true, "no")).not.toThrow();
    expect(() => check(false, "boom")).toThrow("boom");
  });

  it("puts the rationale in a failed criterion message", () => {
    expect(() => checkCriterion(view, "neutral")).not.toThrow();
    expect(() => checkCriterion(view, "listed")).toThrow("criterion listed: failure. From the list.");
  });
});

describe("requestFor", () => {
  it("builds the simulation body from the scenario", () => {
    const body = requestFor(happyPath, vehicleStudy);
    const spec = body.simulationSpecification;
    expect(spec.simulatedUserConfig.prompt?.prompt).toBe(happyPath.persona);
    expect(spec.simulatedUserConfig.language).toBe("en");
    expect("firstMessage" in spec.simulatedUserConfig).toBe(false);
    const spoken = requestFor({ ...happyPath, firstMessage: "Hello" }, vehicleStudy);
    expect(spoken.simulationSpecification.simulatedUserConfig.firstMessage).toBe("Hello");
    expect(spec.toolMockConfig).toEqual({
      mark_question_answered: { defaultReturnValue: "recorded" },
      finish_interview: { defaultReturnValue: "ok" },
    });
    const vars = spec.dynamicVariables as Record<string, unknown>;
    expect(vars.is_resume).toBe(false);
    expect(vars.segment_label).toBe("Current BMW owner");
    expect(vars.question_guide).toContain("[q7] What made you choose BMW");
    expect(body.extraEvaluationCriteria?.map((c) => c.id)).toEqual(["neutral"]);
    expect(body.newTurnsLimit).toBe(40);
  });
});

describe("happy-path assertions", () => {
  const full = [
    "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12",
  ] as const;
  const marks = full.map((id) => agent(`Next question.`, [[id, "answer"]]));

  it("passes a complete, neutral transcript", () => {
    const t = viewOf([...marks, finish("Done.")], ANALYSIS);
    expect(() => happyPath.assert(t, vehicleStudy)).not.toThrow();
  });

  it("fails when a mark is missing or a bracketed id is spoken", () => {
    const t = viewOf([...marks.slice(0, 10), finish("Done.")], ANALYSIS);
    expect(() => happyPath.assert(t, vehicleStudy)).toThrow(/expected q2/);
    const spoken = viewOf([agent("[q2] How long?"), ...marks, finish("Done.")], ANALYSIS);
    expect(() => happyPath.assert(spoken, vehicleStudy)).toThrow(/bracketed id/);
  });
});
