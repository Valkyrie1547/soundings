import { describe, expect, it } from "vitest";
import { guideFor } from "@/lib/study";
import { coffeeStudy, vehicleStudy } from "@/test/fixtures";
import { buildDynamicVariables } from "./session";

const study = vehicleStudy;

describe("buildDynamicVariables", () => {
  it("describes a first session", () => {
    const v = buildDynamicVariables(study, "rid-1", "bmw_customer", []);
    expect(v.respondent_id).toBe("rid-1");
    expect(v.is_resume).toBe(false);
    expect(v.opening_line).toBe(study.interview[0].text);
    expect(v.answered_question_ids).toBe("none");
    expect(v.remaining_count).toBe(11);
    expect(v.prior_context).toBe("(none)");
    expect(v.last_topic).toBe("");
    expect(v.segment_label).toBe("Current BMW owner");
  });

  it("lists one guide line per required question and no q1", () => {
    const v = buildDynamicVariables(study, "rid-1", "potential_bmw_customer", []);
    const lines = String(v.question_guide).split("\n");
    expect(lines).toHaveLength(11);
    expect(lines[0]).toBe("[q2] How long have you owned your current vehicle?");
    expect(lines.some((l) => l.startsWith("[q1]"))).toBe(false);
    expect(lines.find((l) => l.startsWith("[q7]"))).toContain("considered purchasing a BMW");
  });

  it("builds the guide of a different study from the same code", () => {
    const v = buildDynamicVariables(coffeeStudy, "rid-1", "non_subscriber", []);
    const lines = String(v.question_guide).split("\n");
    expect(lines).toHaveLength(6);
    expect(lines[0]).toBe("[q2] Tell me about your coffee routine on a typical day.");
    expect(lines.find((l) => l.startsWith("[q5]"))).toContain("considered a coffee subscription");
    expect(v.segment_label).toBe("Buys coffee without a subscription");
    expect(v.opening_line).toBe(coffeeStudy.interview[0].text);
  });

  it("describes a resumed session from progress", () => {
    const v = buildDynamicVariables(study, "rid-1", "bmw_customer", [
      { questionId: "q2", summary: "Owned for three years.", source: "tool" },
      { questionId: "q3", summary: null, source: "tool" },
    ]);
    const q3 = guideFor(study, "bmw_customer").find((q) => q.id === "q3")!;
    expect(v.is_resume).toBe(true);
    expect(v.last_topic).toBe(q3.topic);
    expect(String(v.opening_line)).toMatch(/^Welcome back/);
    expect(String(v.opening_line)).toContain(q3.topic);
    expect(v.remaining_count).toBe(9);
    expect(v.answered_question_ids).toBe("q2, q3");
    expect(v.prior_context).toBe(`- how long you've owned your vehicle: Owned for three years.\n- ${q3.topic}: (answered)`);
  });

  it("treats a second session with no progress as a resume", () => {
    const v = buildDynamicVariables(study, "rid-1", "bmw_customer", [], 2);
    expect(v.is_resume).toBe(true);
    expect(String(v.opening_line)).toMatch(/^Welcome back/);
    expect(String(v.opening_line)).not.toContain("discussing");
    expect(v.remaining_count).toBe(11);
  });

  it("takes the last topic from guide order, not answer order", () => {
    const v = buildDynamicVariables(study, "rid-1", "bmw_customer", [
      { questionId: "q5", summary: "s5", source: "tool" },
      { questionId: "q2", summary: "s2", source: "tool" },
    ]);
    expect(v.last_topic).toBe(guideFor(study, "bmw_customer").find((q) => q.id === "q5")!.topic);
  });

  it("ignores progress ids that are not in the guide", () => {
    const v = buildDynamicVariables(study, "rid-1", "bmw_customer", [{ questionId: "q99", summary: "x", source: "tool" }]);
    expect(v.prior_context).toBe("(none)");
    expect(v.is_resume).toBe(true);
  });

  it("falls back to the segment id as the label when the segment is unknown", () => {
    expect(buildDynamicVariables(study, "rid-1", "ghost", []).segment_label).toBe("ghost");
  });
});
