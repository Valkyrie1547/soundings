import { CLIENT_TOOLS } from "../../../src/lib/interview/agent-config";
import { requiredIds } from "../../../src/lib/study";
import { NEUTRAL } from "../criteria";
import { check, checkCriterion, type Scenario } from "../harness";
import { BRACKETED_ID, cooperative } from "./shared";

/**
 * The coffee study, end to end. The agent has never seen these questions.
 * The guide comes in as dynamic variables, so the same agent marks each id
 * of the second study and finishes once. This is the proof that the agent
 * is study-agnostic.
 */
export const secondStudyHappyPath: Scenario = {
  name: "second-study-happy-path",
  studyId: "coffee-subscription",
  segment: "subscriber",
  progress: [],
  attemptNo: 1,
  persona: cooperative("a monthly coffee subscription from a small roaster", "coffee habits"),
  newTurnsLimit: 30,
  criteria: [NEUTRAL],
  passRate: 1,
  assert(t, study) {
    const marked = t.markedIds();
    const expected = requiredIds(study, "subscriber");
    check(marked.join(",") === expected.join(","), `marked ${marked.join(",") || "nothing"}, expected ${expected.join(",")}`);

    const finishes = t.toolCalls(CLIENT_TOOLS.finish);
    check(finishes.length === 1, `finish_interview called ${finishes.length} times`);
    check(t.agentNeverSaid(BRACKETED_ID), "agent read a bracketed id aloud");
    check(t.agentNeverSaid(/vehicle|BMW/i), "agent mentioned the vehicle study");
    checkCriterion(t, NEUTRAL.id);
  },
};
