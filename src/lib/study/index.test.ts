import { afterEach, describe, expect, it, vi } from "vitest";
import { coffeeStudy, makeStudy, vehicleStudy } from "@/test/fixtures";
import { copyFor, guideFor, isComplete, requiredIds, segmentLabel, transcriptLabel } from "./index";

const ALL_REQUIRED = ["q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12"];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("guideFor", () => {
  it("gives each vehicle segment 12 questions with shared q1 to q6 and q12", () => {
    const bmw = guideFor(vehicleStudy, "bmw_customer");
    const potential = guideFor(vehicleStudy, "potential_bmw_customer");
    expect(bmw.map((q) => q.id)).toEqual(["q1", ...ALL_REQUIRED]);
    expect(potential.map((q) => q.id)).toEqual(["q1", ...ALL_REQUIRED]);
    for (const id of ["q1", "q2", "q6", "q12"]) {
      expect(bmw.find((q) => q.id === id)?.text).toBe(potential.find((q) => q.id === id)?.text);
    }
    for (const id of ["q7", "q8", "q9", "q10", "q11"]) {
      expect(bmw.find((q) => q.id === id)?.text).not.toBe(potential.find((q) => q.id === id)?.text);
    }
  });

  it("filters the coffee study by its own segments", () => {
    expect(guideFor(coffeeStudy, "subscriber").map((q) => q.id)).toEqual(["q1", "q2", "q3", "q4", "q5", "q6", "q7"]);
    expect(guideFor(coffeeStudy, "subscriber").find((q) => q.id === "q5")?.text).toContain("sign up");
    expect(guideFor(coffeeStudy, "non_subscriber").find((q) => q.id === "q5")?.text).toContain("considered");
  });

  it("keeps the readiness check, the first two required, and the last required in short mode", () => {
    vi.stubEnv("INTERVIEW_SHORT_MODE", "1");
    expect(guideFor(vehicleStudy, "bmw_customer").map((q) => q.id)).toEqual(["q1", "q2", "q3", "q12"]);
    expect(requiredIds(vehicleStudy, "bmw_customer")).toEqual(["q2", "q3", "q12"]);
    expect(guideFor(coffeeStudy, "subscriber").map((q) => q.id)).toEqual(["q1", "q2", "q3", "q7"]);
  });

  it("does not use short mode for other values", () => {
    vi.stubEnv("INTERVIEW_SHORT_MODE", "0");
    expect(guideFor(vehicleStudy, "bmw_customer")).toHaveLength(12);
  });
});

describe("requiredIds and isComplete", () => {
  it("excludes the readiness check", () => {
    expect(requiredIds(vehicleStudy, "bmw_customer")).toEqual(ALL_REQUIRED);
    expect(requiredIds(makeStudy(), "a")).toEqual(["q2", "q3"]);
  });

  it("is complete only when every required id is present, and ignores extra ids", () => {
    expect(isComplete(vehicleStudy, "bmw_customer", new Set(ALL_REQUIRED))).toBe(true);
    expect(isComplete(vehicleStudy, "bmw_customer", new Set(ALL_REQUIRED.slice(1)))).toBe(false);
    expect(isComplete(vehicleStudy, "bmw_customer", new Set([...ALL_REQUIRED, "q1", "q99"]))).toBe(true);
    expect(isComplete(makeStudy(), "b", new Set(["q2", "q3"]))).toBe(true);
  });
});

describe("labels and copy", () => {
  it("reads segment labels from the study and falls back to the id", () => {
    expect(segmentLabel(vehicleStudy, "bmw_customer")).toBe("Current BMW owner");
    expect(transcriptLabel(vehicleStudy, "potential_bmw_customer")).toBe("Potential BMW Customer");
    expect(segmentLabel(vehicleStudy, "nope")).toBe("nope");
    expect(transcriptLabel(coffeeStudy, "subscriber")).toBe("Subscriber");
  });

  it("gives every copy field a default and lets a study override one", () => {
    const defaults = copyFor(makeStudy());
    expect(defaults.interviewBody).toContain("{total}");
    expect(defaults.qualified).toMatch(/voice interview/);
    const own = copyFor(makeStudy({ copy: { interviewHeading: "Hello." } }));
    expect(own.interviewHeading).toBe("Hello.");
    expect(own.screenedOut).toBe(defaults.screenedOut);
    expect(copyFor(vehicleStudy).interviewHeading).toBe("A short conversation about your car.");
  });
});
