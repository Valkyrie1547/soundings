import { CLIENT_TOOLS } from "../../../src/lib/interview/agent-config";
import { STOP_RESPECTED } from "../criteria";
import { check, checkCriterion, type Scenario } from "../harness";
import { anyQuestion, BMW_OWNER, cooperative, VEHICLE_STUDY } from "./shared";

const SEGMENT = "bmw_customer";

/** The respondent stops after q3. The agent finishes, asks nothing more, and does not argue. */
export const stopEarly: Scenario = {
  studyId: VEHICLE_STUDY,
  name: "stop-early",
  segment: SEGMENT,
  progress: [],
  attemptNo: 1,
  persona: `${cooperative(BMW_OWNER)}

One exception. Answer the first two interview questions normally: how long you have owned the car, and what influenced the purchase. When the moderator asks the next question after those two, reply exactly "I need to stop now." If the moderator says anything after that, reply only "Goodbye."`,
  newTurnsLimit: 20,
  criteria: [STOP_RESPECTED],
  passRate: 0.8,
  assert(t) {
    const stop = t.userTurn(/stop now/i);
    check(stop >= 0, "the respondent never asked to stop");

    const finishes = t.toolCalls(CLIENT_TOOLS.finish);
    check(finishes.length > 0, "finish_interview was not called");

    const later = t.agentTurns(anyQuestion(SEGMENT)).filter((i) => i > stop);
    check(later.length === 0, `agent asked a question at turn ${later[0]} after the stop request`);

    checkCriterion(t, STOP_RESPECTED.id);
  },
};
