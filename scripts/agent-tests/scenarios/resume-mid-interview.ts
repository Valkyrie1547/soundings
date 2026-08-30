import { guideFor, type ProgressEntry } from "../../../src/lib/interview/session";
import { check, type Scenario } from "../harness";
import { anyQuestion, BMW_OWNER, cooperative, INTRO, wording } from "./shared";

const SEGMENT = "bmw_customer";

const progress: ProgressEntry[] = [
  { questionId: "q2", summary: "They have owned the car for about three years.", source: "tool" },
  { questionId: "q3", summary: "Driving dynamics and the dealer's trade-in offer influenced the purchase.", source: "tool" },
  { questionId: "q4", summary: "They rate their satisfaction at eight out of ten.", source: "tool" },
  { questionId: "q5", summary: "They value the handling and the interior most.", source: "tool" },
];

const Q5_TOPIC = guideFor(SEGMENT).find((q) => q.id === "q5")?.topic ?? "";

/** A second session with q2 to q5 answered. The greeting names the q5 topic, and the agent goes straight to q6. */
export const resumeMidInterview: Scenario = {
  name: "resume-mid-interview",
  segment: SEGMENT,
  progress,
  attemptNo: 2,
  persona: `${cooperative(BMW_OWNER)}

This is a second session. Earlier today you already answered a few questions. When the moderator welcomes you back and asks to continue, reply "Yes, let's continue." Then answer every question normally.`,
  newTurnsLimit: 32,
  criteria: [],
  passRate: 1,
  assert(t) {
    const first = t.firstAgentTurn();
    check(first.startsWith("Welcome back"), `first agent turn is "${first.slice(0, 60)}"`);
    check(first.includes(Q5_TOPIC), `first agent turn does not name the q5 topic "${Q5_TOPIC}"`);

    const firstQuestion = t.agentTurns(anyQuestion(SEGMENT))[0];
    const q6 = t.agentTurns(wording(SEGMENT, "q6"))[0];
    check(q6 !== undefined && q6 === firstQuestion, `first question asked at turn ${firstQuestion} is not q6`);

    for (const id of ["q2", "q3", "q4", "q5"]) {
      check(t.agentNeverSaid(wording(SEGMENT, id)), `agent asked ${id} again`);
    }
    check(t.agentNeverSaid(INTRO), "agent repeated the introduction");
  },
};
