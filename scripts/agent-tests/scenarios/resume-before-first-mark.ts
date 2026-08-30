import { check, type Scenario } from "../harness";
import { anyQuestion, BMW_OWNER, cooperative, INTRO, wording, VEHICLE_STUDY } from "./shared";

const SEGMENT = "bmw_customer";

/** The opening line from `buildDynamicVariables` when no question was marked. The apostrophe may change shape. */
const NOT_STARTED = /We hadn.t started the questions yet/;

/** A second session with nothing answered. The agent says the questions had not started, and asks q2 next. */
export const resumeBeforeFirstMark: Scenario = {
  studyId: VEHICLE_STUDY,
  name: "resume-before-first-mark",
  segment: SEGMENT,
  progress: [],
  attemptNo: 2,
  persona: `${cooperative(BMW_OWNER)}

This is a second session. Your first session ended before any question was asked. When the moderator welcomes you back and asks to continue, reply "Yes, let's continue." Then answer every question normally.`,
  newTurnsLimit: 40,
  criteria: [],
  passRate: 1,
  assert(t) {
    const first = t.firstAgentTurn();
    check(NOT_STARTED.test(first), `first agent turn is "${first.slice(0, 80)}"`);
    check(t.agentNeverSaid(INTRO), "agent introduced the interview again");

    const firstQuestion = t.agentTurns(anyQuestion(SEGMENT))[0];
    const q2 = t.agentTurns(wording(SEGMENT, "q2"))[0];
    check(q2 !== undefined && q2 === firstQuestion, `first question asked at turn ${firstQuestion} is not q2`);
  },
};
