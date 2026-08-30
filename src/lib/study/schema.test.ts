import { describe, expect, it } from "vitest";
import { coffeeStudy, makeStudy, vehicleStudy } from "@/test/fixtures";
import { parseStudy, type StudyConfig } from "./schema";

/** The issue paths of one parse, as dotted strings. */
function issuesOf(input: unknown): string[] {
  const result = parseStudy(input);
  return result.issues?.map((i) => `${i.path}: ${i.message}`) ?? [];
}

describe("StudySchema", () => {
  it("accepts both sample studies and the minimal fixture", () => {
    expect(parseStudy(vehicleStudy).study?.id).toBe("vehicle-ownership");
    expect(parseStudy(coffeeStudy).study?.id).toBe("coffee-subscription");
    expect(issuesOf(makeStudy())).toEqual([]);
  });

  it("rejects a study that is not an object", () => {
    expect(issuesOf(null).length).toBeGreaterThan(0);
    expect(issuesOf("x").length).toBeGreaterThan(0);
  });

  it("requires a slug id and a positive version", () => {
    expect(issuesOf(makeStudy({ id: "Bad Id" }))[0]).toMatch(/^id: /);
    expect(issuesOf(makeStudy({ version: 0 }))[0]).toMatch(/^version: /);
  });

  it("rejects a duplicate screening id at its path", () => {
    const study = makeStudy();
    const s = { ...study, screening: [study.screening[0], { ...study.screening[0] }] };
    expect(issuesOf(s)).toContain('screening.1.id: duplicate screening id "pick"');
  });

  it("rejects a duplicate option id inside one question", () => {
    const study = makeStudy();
    const q = study.screening[0];
    const s = { ...study, screening: [{ ...q, options: [q.options[0], q.options[0], q.options[2]] }] };
    expect(issuesOf(s)).toContain('screening.0.options.1.id: duplicate option id "a"');
  });

  it("rejects a qualify effect that names an unknown segment", () => {
    const study = makeStudy();
    const q = study.screening[0];
    const options = [{ ...q.options[0], effect: { kind: "qualify" as const, outcome: "ghost" } }, q.options[1], q.options[2]];
    const s = { ...study, screening: [{ ...q, options }] };
    expect(issuesOf(s)).toContain('screening.0.options.0.effect.outcome: unknown segment "ghost"');
  });

  it("rejects a screening set that can never end or never qualify", () => {
    const study = makeStudy();
    const q = study.screening[0];
    const noEffects = { ...study, screening: [{ ...q, options: q.options.map((o) => ({ id: o.id, label: o.label })) }] };
    expect(issuesOf(noEffects)).toContain("screening: no option qualifies or terminates, so the survey never ends");
    const onlyTerminate = { ...study, screening: [{ ...q, options: [q.options[2], { id: "x", label: "X" }] }] };
    expect(issuesOf(onlyTerminate)).toContain("screening: no option qualifies, so nobody reaches the interview");
  });

  it("rejects a duplicate interview id for the same audience but allows one per segment", () => {
    const study = makeStudy();
    const dup = { ...study, interview: [...study.interview, { ...study.interview[1] }] };
    expect(issuesOf(dup)).toContain('interview.4.id: duplicate interview id for the same audience "q2|all"');
    expect(issuesOf(study)).toEqual([]); // q3 exists once for "a" and once for "b".
  });

  it("rejects an audience that names an unknown segment", () => {
    const study = makeStudy();
    const s = { ...study, interview: [...study.interview, { ...study.interview[1], id: "q9", audience: "ghost" }] };
    expect(issuesOf(s)).toContain('interview.4.audience: unknown segment "ghost"');
  });

  it("requires the first interview question to be the optional readiness check", () => {
    const study = makeStudy();
    const s = { ...study, interview: [{ ...study.interview[0], required: true }, ...study.interview.slice(1)] };
    expect(issuesOf(s)).toContain("interview.0.required: the first interview question is the readiness check and must not be required");
  });

  it("requires every segment to have at least one required question", () => {
    const study = makeStudy();
    const s = { ...study, interview: study.interview.map((q) => (q.audience === "all" ? { ...q, required: false } : q)).slice(0, 3) };
    expect(issuesOf(s)).toContain('interview: segment "b" has no required question');
  });

  it("requires the precedence list to name known segments and cover every segment", () => {
    expect(issuesOf(makeStudy({ outcomePrecedence: ["a", "ghost"] }))).toContain('outcomePrecedence.1: unknown segment "ghost"');
    expect(issuesOf(makeStudy({ outcomePrecedence: ["a"] }))).toContain('outcomePrecedence: segment "b" is missing from the precedence list');
  });

  it("rejects a duplicate segment id", () => {
    const study = makeStudy();
    const s: StudyConfig = { ...study, segments: [study.segments[0], { ...study.segments[0] }], outcomePrecedence: ["a"] };
    expect(issuesOf(s)).toContain('segments.1.id: duplicate segment id "a"');
  });

  it("strips nothing and keeps optional fields", () => {
    const parsed = parseStudy(vehicleStudy).study!;
    expect(parsed.copy?.interviewHeading).toBe("A short conversation about your car.");
    expect(parsed.interview.find((q) => q.id === "q4")?.anchor).toBe("scale of 1 to 10");
  });
});
