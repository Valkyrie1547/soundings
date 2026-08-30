import type { Scenario } from "../harness";
import { happyPath } from "./happy-path";
import { notReadyThenSilent } from "./not-ready-then-silent";
import { resumeBeforeFirstMark } from "./resume-before-first-mark";
import { resumeMidInterview } from "./resume-mid-interview";
import { secondStudyHappyPath } from "./second-study-happy-path";
import { segmentRouting } from "./segment-routing";
import { skipRequest } from "./skip-request";
import { stopEarly } from "./stop-early";

/** All scenarios, in the order of the brief. The second-study scenario proves the agent is study-agnostic. */
export const scenarios: Scenario[] = [
  happyPath,
  skipRequest,
  notReadyThenSilent,
  resumeMidInterview,
  resumeBeforeFirstMark,
  stopEarly,
  segmentRouting,
  secondStudyHappyPath,
];
