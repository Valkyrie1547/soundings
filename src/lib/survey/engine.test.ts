import { describe, expect, it } from "vitest";
import { study } from "@/config/study";
import { judge, resolve, type Answers } from "./engine";

const base: Answers = { age: "25_34", income: "100k_150k", owns_car: "yes" };

describe("resolve", () => {
  it("shows the first unanswered question, in order", () => {
    expect(resolve(study, {})).toMatchObject({ status: "in_progress", index: 0, question: { id: "age" } });
    expect(resolve(study, { age: "25_34" })).toMatchObject({ status: "in_progress", index: 1, question: { id: "income" } });
    expect(resolve(study, base)).toMatchObject({ status: "in_progress", index: 3, question: { id: "brands" } });
  });

  it("ends the survey at an age under 18 and ignores later answers", () => {
    expect(resolve(study, { ...base, age: "under_18", brands: ["bmw"] })).toEqual({ status: "screened_out", atQuestion: "age" });
  });

  it("ends the survey when the respondent owns no car", () => {
    expect(resolve(study, { ...base, owns_car: "no" })).toEqual({ status: "screened_out", atQuestion: "owns_car" });
  });

  it.each([
    [["bmw"], "bmw_customer"],
    [["mercedes"], "potential_bmw_customer"],
    [["audi"], "potential_bmw_customer"],
    [["bmw", "toyota"], "bmw_customer"],
    [["toyota", "bmw"], "bmw_customer"],
    [["bmw", "audi"], "bmw_customer"],
    [["audi", "mercedes"], "potential_bmw_customer"],
  ])("brands %j qualifies as %s", (brands, outcome) => {
    expect(resolve(study, { ...base, brands })).toEqual({ status: "qualified", outcome });
  });

  it.each([[["toyota"]], [["other"]], [["honda", "ford", "tesla"]]])("brands %j screens out at the brands question", (brands) => {
    expect(resolve(study, { ...base, brands })).toEqual({ status: "screened_out", atQuestion: "brands" });
  });
});

describe("judge", () => {
  const age = study.screening[0];
  const brands = study.screening[3];

  it("returns continue for an option with no effect", () => {
    expect(judge(age, "25_34", study.outcomePrecedence)).toEqual({ kind: "continue" });
  });

  it("returns terminate for a terminate option", () => {
    expect(judge(age, "under_18", study.outcomePrecedence)).toEqual({ kind: "terminate" });
  });

  it("lets a qualify option win over a terminate option", () => {
    expect(judge(brands, ["toyota", "audi"], study.outcomePrecedence)).toEqual({
      kind: "qualify",
      outcome: "potential_bmw_customer",
    });
  });

  it("uses the precedence list when more than one outcome qualifies", () => {
    expect(judge(brands, ["audi", "bmw"], ["potential_bmw_customer", "bmw_customer"])).toEqual({
      kind: "qualify",
      outcome: "potential_bmw_customer",
    });
  });

  it("ignores option ids that are not in the question", () => {
    expect(judge(brands, ["lada"], study.outcomePrecedence)).toEqual({ kind: "continue" });
  });
});
