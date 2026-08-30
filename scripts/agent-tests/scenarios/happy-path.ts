import { CLIENT_TOOLS } from "../../../src/lib/interview/agent-config";
import { requiredIds } from "../../../src/lib/study";
import { NEUTRAL } from "../criteria";
import { check, checkCriterion, type Scenario } from "../harness";
import { BMW_OWNER, BRACKETED_ID, cooperative, VEHICLE_STUDY } from "./shared";

/** A BMW owner answers every question in order. The agent marks each one and finishes once. */
export const happyPath: Scenario = {
  studyId: VEHICLE_STUDY,
  name: "happy-path",
  segment: "bmw_customer",
  progress: [],
  attemptNo: 1,
  persona: cooperative(BMW_OWNER),
  newTurnsLimit: 40,
  criteria: [NEUTRAL],
  passRate: 1,
  assert(t, study) {
    const marked = t.markedIds();
    const expected = requiredIds(study, "bmw_customer");
    check(marked.join(",") === expected.join(","), `marked ${marked.join(",") || "nothing"}, expected ${expected.join(",")}`);

    const finishes = t.toolCalls(CLIENT_TOOLS.finish);
    check(finishes.length === 1, `finish_interview called ${finishes.length} times`);
    const lastMark = Math.max(...t.toolCalls(CLIENT_TOOLS.markAnswered).map((c) => c.turnIndex));
    check(finishes[0].turnIndex >= lastMark, `finish_interview at turn ${finishes[0].turnIndex}, before the last mark at ${lastMark}`);

    check(t.agentNeverSaid(BRACKETED_ID), "agent read a bracketed id aloud");
    checkCriterion(t, NEUTRAL.id);
  },
};
