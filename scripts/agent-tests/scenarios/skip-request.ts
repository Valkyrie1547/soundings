import { SKIP_HANDLED } from "../criteria";
import { check, checkCriterion, type Scenario } from "../harness";
import { BMW_OWNER, cooperative, wording } from "./shared";

const Q4 = wording("bmw_customer", "q4");

/** The respondent refuses q4 twice. The agent leaves it open, asks it again before the close, and marks it only then. */
export const skipRequest: Scenario = {
  name: "skip-request",
  segment: "bmw_customer",
  progress: [],
  attemptNo: 1,
  persona: `${cooperative(BMW_OWNER)}

One exception. The first time the moderator asks you to rate your satisfaction on a scale of 1 to 10, reply only "Next question." If the moderator asks for the rating again right after that, reply only "Skip." If the moderator comes back to the rating later, near the end of the interview, answer it normally: "I'd say an eight."`,
  newTurnsLimit: 44,
  criteria: [SKIP_HANDLED],
  passRate: 0.8,
  assert(t) {
    const q12Mark = t.markTurn("q12");
    check(q12Mark >= 0, "q12 was never marked");

    const q4Mark = t.markTurn("q4");
    check(q4Mark < 0 || q4Mark > q12Mark, `q4 marked at turn ${q4Mark}, before q12 at ${q12Mark}`);

    const reasked = t.agentTurns(Q4).filter((i) => i > q12Mark);
    check(reasked.length > 0, "q4 was not asked again after the q12 mark");

    checkCriterion(t, SKIP_HANDLED.id);
  },
};
