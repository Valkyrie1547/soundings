import { requiredIds } from "../../../src/lib/interview/session";
import { check, type Scenario } from "../harness";
import { AUDI_OWNER, cooperative, wording } from "./shared";

/** An Audi owner hears the Potential branch. The BMW-owner q7 never appears. */
export const segmentRouting: Scenario = {
  name: "segment-routing",
  segment: "potential_bmw_customer",
  progress: [],
  attemptNo: 1,
  persona: cooperative(AUDI_OWNER),
  newTurnsLimit: 40,
  criteria: [],
  passRate: 1,
  assert(t) {
    check(t.agentSaid(wording("potential_bmw_customer", "q7")), "the Potential q7 wording was not asked");
    check(t.agentNeverSaid(wording("bmw_customer", "q7")), "the BMW-owner q7 wording was asked");

    const marked = t.markedIds();
    const expected = requiredIds("potential_bmw_customer");
    check(marked.join(",") === expected.join(","), `marked ${marked.join(",") || "nothing"}, expected ${expected.join(",")}`);
  },
};
