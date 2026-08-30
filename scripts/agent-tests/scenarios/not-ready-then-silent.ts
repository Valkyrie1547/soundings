import { CLIENT_TOOLS } from "../../../src/lib/interview/agent-config";
import { WAITED_QUIETLY } from "../criteria";
import { check, checkCriterion, type Scenario } from "../harness";
import { BMW_OWNER, cooperative } from "./shared";

/** The agent must never describe its instructions. */
const LEAKED_INSTRUCTIONS = /prompt|instruct|told to|I was asked|still there|check(ing)? (if|whether)/i;

/** A user turn that says ready, and does not say "not". */
function readyTurn(t: Parameters<Scenario["assert"]>[0]): number {
  return t.turns.findIndex((turn) => {
    const text = turn.message ?? "";
    return turn.role === "user" && /ready/i.test(text) && !/\bnot\b/i.test(text);
  });
}

/** The respondent is not ready, then silent twice. The agent waits and does not narrate its prompt. */
export const notReadyThenSilent: Scenario = {
  name: "not-ready-then-silent",
  segment: "bmw_customer",
  progress: [],
  attemptNo: 1,
  persona: `${cooperative(BMW_OWNER)}

One exception, at the start. When the moderator first asks if you are ready to begin, reply exactly "No, not yet." Your next two replies must be silence: send an empty message with no words at all. If you cannot send an empty message, send only "...". After those two silent turns, reply "Ok, ready." and then answer every question normally.`,
  newTurnsLimit: 44,
  criteria: [WAITED_QUIETLY],
  passRate: 0.8,
  assert(t) {
    check(t.agentNeverSaid(LEAKED_INSTRUCTIONS), "agent described its instructions");

    const ready = readyTurn(t);
    check(ready >= 0, "the respondent never said ready");
    const early = t.toolCalls(CLIENT_TOOLS.markAnswered).filter((c) => c.turnIndex < ready);
    check(early.length === 0, `${early.length} question(s) marked before the respondent said ready`);

    checkCriterion(t, WAITED_QUIETLY.id);
  },
};
