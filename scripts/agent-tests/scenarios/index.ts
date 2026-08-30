import type { Scenario } from "../harness";
import { happyPath } from "./happy-path";
import { notReadyThenSilent } from "./not-ready-then-silent";
import { resumeBeforeFirstMark } from "./resume-before-first-mark";
import { resumeMidInterview } from "./resume-mid-interview";
import { segmentRouting } from "./segment-routing";
import { skipRequest } from "./skip-request";
import { stopEarly } from "./stop-early";

/** All scenarios, in the order of the brief. */
export const scenarios: Scenario[] = [
  happyPath,
  skipRequest,
  notReadyThenSilent,
  resumeMidInterview,
  resumeBeforeFirstMark,
  stopEarly,
  segmentRouting,
];
