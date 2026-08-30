import { describe, expect, it } from "vitest";
import type { TranscriptTurn } from "@/db/schema";
import { interviewGuideFor } from "@/config/study";
import { findUnmarkedAnswers, matchesQuestion } from "./backstop";

const guide = interviewGuideFor("bmw_customer");
const text = (id: string) => guide.find((q) => q.id === id)!.text;

function turns(pairs: [TranscriptTurn["role"], string][]): TranscriptTurn[] {
  return pairs.map(([role, message], i) => ({ role, message, timeInCallSecs: i * 5 }));
}

describe("findUnmarkedAnswers", () => {
  it("returns one candidate with the joined summary for an exact question and a two-turn answer", () => {
    const t = turns([
      ["agent", text("q6")],
      ["user", "Yes, the infotainment screen froze twice last winter."],
      ["user", "The dealer fixed it under warranty though."],
      ["agent", text("q7")],
      ["user", "The driving feel, mostly."],
    ]);
    const out = findUnmarkedAnswers(guide, ["q6"], t);
    expect(out).toHaveLength(1);
    expect(out[0].questionId).toBe("q6");
    expect(out[0].summary).toBe(
      "Yes, the infotainment screen froze twice last winter. The dealer fixed it under warranty though.",
    );
    expect(out[0].evidence.userTurns).toHaveLength(2);
    expect(out[0].evidence.agentTurn.message).toBe(text("q6"));
  });

  it("returns no candidate when the user asks for the next question", () => {
    const t = turns([
      ["agent", text("q6")],
      ["user", "Next question please, I would rather not say."],
      ["agent", text("q7")],
    ]);
    expect(findUnmarkedAnswers(guide, ["q6"], t)).toEqual([]);
  });

  it("returns no candidate for a three-word answer", () => {
    const t = turns([
      ["agent", text("q6")],
      ["user", "No, not really."],
      ["agent", text("q7")],
    ]);
    expect(findUnmarkedAnswers(guide, ["q6"], t)).toEqual([]);
  });

  it("returns no candidate when the question was never asked, even if the user mentions the topic", () => {
    const t = turns([
      ["agent", text("q5")],
      ["user", "I value the handling, although I have had issues and concerns with the brakes."],
      ["agent", text("q7")],
    ]);
    expect(findUnmarkedAnswers(guide, ["q6"], t)).toEqual([]);
  });

  it("returns exactly one candidate with the correct id when one of two missing questions is answered", () => {
    const t = turns([
      ["agent", text("q6")],
      ["user", "Yes, a rattle from the dashboard that the dealer never found."],
      ["agent", text("q7")],
      ["user", "Skip that one."],
      ["agent", text("q8")],
    ]);
    const out = findUnmarkedAnswers(guide, ["q6", "q7"], t);
    expect(out.map((c) => c.questionId)).toEqual(["q6"]);
  });

  it("matches a paraphrased question through its anchor where token overlap would not", () => {
    const q4 = guide.find((q) => q.id === "q4")!;
    const paraphrase = "Okay. Thinking about it overall, on a scale of 1 to 10, where would you put it?";
    expect(matchesQuestion({ ...q4, anchor: undefined }, paraphrase)).toBe(false);
    expect(matchesQuestion(q4, paraphrase)).toBe(true);
    const t = turns([
      ["agent", paraphrase],
      ["user", "I would say an eight out of ten."],
      ["agent", text("q5")],
    ]);
    expect(findUnmarkedAnswers(guide, ["q4"], t).map((c) => c.questionId)).toEqual(["q4"]);
  });

  it("does not match the other segment's q7 wording", () => {
    const otherQ7 = interviewGuideFor("potential_bmw_customer").find((q) => q.id === "q7")!.text;
    const t = turns([
      ["agent", otherQ7],
      ["user", "Yes, I test drove one last year and liked it a lot."],
      ["agent", text("q8")],
    ]);
    expect(findUnmarkedAnswers(guide, ["q7"], t)).toEqual([]);
  });

  it("returns no candidate when the agent says the question stays open", () => {
    const t = turns([
      ["agent", text("q6")],
      ["user", "Hmm, can we come back to that one later?"],
      ["agent", "Of course, we can come back to that later."],
      ["agent", text("q7")],
    ]);
    expect(findUnmarkedAnswers(guide, ["q6"], t)).toEqual([]);
  });

  it("ignores ids that are not in the guide and never returns q1", () => {
    const t = turns([
      ["agent", text("q1")],
      ["user", "Yes, I am ready to begin, let us go."],
      ["agent", text("q2")],
    ]);
    expect(findUnmarkedAnswers(guide, ["q1", "q99"], t)).toEqual([]);
  });

  it("cuts the summary at 200 characters", () => {
    const long = "word ".repeat(80).trim();
    const t = turns([["agent", text("q6")], ["user", long]]);
    expect(findUnmarkedAnswers(guide, ["q6"], t)[0].summary).toHaveLength(200);
  });
});
