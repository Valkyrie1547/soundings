import { afterEach, describe, expect, it, vi } from "vitest";
import { study } from "@/config/study";
import { buildDynamicVariables, guideFor, isComplete, requiredIds } from "./session";

const ALL_REQUIRED = ["q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12"];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("guideFor", () => {
  it("gives each segment 12 questions with shared q1 to q6 and q12", () => {
    const bmw = guideFor("bmw_customer");
    const potential = guideFor("potential_bmw_customer");
    expect(bmw).toHaveLength(12);
    expect(potential).toHaveLength(12);
    expect(bmw.map((q) => q.id)).toEqual(["q1", ...ALL_REQUIRED]);
    expect(potential.map((q) => q.id)).toEqual(["q1", ...ALL_REQUIRED]);
    for (const id of ["q1", "q2", "q6", "q12"]) {
      expect(bmw.find((q) => q.id === id)?.text).toBe(potential.find((q) => q.id === id)?.text);
    }
  });

  it("gives each segment its own q7 to q11", () => {
    const bmw = guideFor("bmw_customer");
    const potential = guideFor("potential_bmw_customer");
    for (const id of ["q7", "q8", "q9", "q10", "q11"]) {
      expect(bmw.find((q) => q.id === id)?.text).not.toBe(potential.find((q) => q.id === id)?.text);
    }
  });

  it("limits the guide in short mode", () => {
    vi.stubEnv("INTERVIEW_SHORT_MODE", "1");
    expect(guideFor("bmw_customer").map((q) => q.id)).toEqual(["q1", "q2", "q3", "q12"]);
    expect(requiredIds("bmw_customer")).toEqual(["q2", "q3", "q12"]);
  });

  it("does not use short mode for other values", () => {
    vi.stubEnv("INTERVIEW_SHORT_MODE", "0");
    expect(guideFor("bmw_customer")).toHaveLength(12);
  });
});

describe("requiredIds", () => {
  it("excludes the readiness check and has 11 ids", () => {
    expect(requiredIds("bmw_customer")).toEqual(ALL_REQUIRED);
    expect(requiredIds("potential_bmw_customer")).toEqual(ALL_REQUIRED);
  });
});

describe("isComplete", () => {
  it("is true only when every required id is present", () => {
    expect(isComplete("bmw_customer", new Set(ALL_REQUIRED))).toBe(true);
    expect(isComplete("bmw_customer", new Set(ALL_REQUIRED.slice(1)))).toBe(false);
    expect(isComplete("bmw_customer", new Set())).toBe(false);
  });

  it("ignores extra ids", () => {
    expect(isComplete("bmw_customer", new Set([...ALL_REQUIRED, "q1", "q99"]))).toBe(true);
  });
});

describe("buildDynamicVariables", () => {
  it("describes a first session", () => {
    const v = buildDynamicVariables("rid-1", "bmw_customer", []);
    expect(v.respondent_id).toBe("rid-1");
    expect(v.is_resume).toBe(false);
    expect(v.opening_line).toBe(study.interview[0].text);
    expect(v.answered_question_ids).toBe("none");
    expect(v.remaining_count).toBe(11);
    expect(v.prior_context).toBe("(none)");
    expect(v.last_topic).toBe("");
    expect(v.segment_label).toMatch(/BMW/);
  });

  it("lists one guide line per required question and no q1", () => {
    const v = buildDynamicVariables("rid-1", "potential_bmw_customer", []);
    const lines = String(v.question_guide).split("\n");
    expect(lines).toHaveLength(11);
    expect(lines[0]).toBe("[q2] How long have you owned your current vehicle?");
    expect(lines.some((l) => l.startsWith("[q1]"))).toBe(false);
    expect(lines.find((l) => l.startsWith("[q7]"))).toContain("considered purchasing a BMW");
  });

  it("describes a resumed session from progress", () => {
    const v = buildDynamicVariables("rid-1", "bmw_customer", [
      { questionId: "q2", summary: "Owned for three years." },
      { questionId: "q3", summary: null },
    ]);
    const q3 = guideFor("bmw_customer").find((q) => q.id === "q3")!;
    expect(v.is_resume).toBe(true);
    expect(v.last_topic).toBe(q3.topic);
    expect(String(v.opening_line)).toMatch(/^Welcome back/);
    expect(String(v.opening_line)).toContain(q3.topic);
    expect(v.remaining_count).toBe(9);
    expect(v.answered_question_ids).toBe("q2, q3");
    expect(v.prior_context).toBe(`- how long you've owned your vehicle: Owned for three years.\n- ${q3.topic}: (answered)`);
  });

  it("takes the last topic from guide order, not answer order", () => {
    const v = buildDynamicVariables("rid-1", "bmw_customer", [
      { questionId: "q5", summary: "s5" },
      { questionId: "q2", summary: "s2" },
    ]);
    expect(v.last_topic).toBe(guideFor("bmw_customer").find((q) => q.id === "q5")!.topic);
  });

  it("ignores progress ids that are not in the guide", () => {
    const v = buildDynamicVariables("rid-1", "bmw_customer", [{ questionId: "q99", summary: "x" }]);
    expect(v.prior_context).toBe("(none)");
    expect(v.is_resume).toBe(true);
  });
});
