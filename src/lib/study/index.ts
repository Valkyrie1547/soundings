import type { InterviewQuestion, Outcome, StudyConfig } from "./schema";

export type {
  InterviewQuestion,
  MultiSelectQuestion,
  Option,
  OptionEffect,
  Outcome,
  Question,
  Segment,
  SingleSelectQuestion,
  StudyConfig,
  StudyIssue,
} from "./schema";
export { parseStudy, StudySchema } from "./schema";

/** The full guide that one segment hears, in order. */
export function interviewGuideFor(study: StudyConfig, segment: Outcome): InterviewQuestion[] {
  return study.interview.filter((q) => q.audience === "all" || q.audience === segment);
}

/**
 * The guide a respondent hears. In short mode (development only) the
 * interview keeps the readiness check, the first two required questions,
 * and the last required question. One full run then uses about 2 platform
 * minutes instead of 12. The required set, the progress, and the completion
 * check all come from this one function. Short mode cannot disagree with
 * itself.
 */
export function guideFor(study: StudyConfig, segment: Outcome): InterviewQuestion[] {
  const full = interviewGuideFor(study, segment);
  if (process.env.INTERVIEW_SHORT_MODE !== "1") return full;
  const required = full.filter((q) => q.required);
  const keep = new Set([...required.slice(0, 2), required.at(-1)].map((q) => q?.id));
  return full.filter((q) => !q.required || keep.has(q.id));
}

export function requiredIds(study: StudyConfig, segment: Outcome): string[] {
  return guideFor(study, segment)
    .filter((q) => q.required)
    .map((q) => q.id);
}

export function isComplete(study: StudyConfig, segment: Outcome, answered: Set<string>): boolean {
  return requiredIds(study, segment).every((id) => answered.has(id));
}

/** How the agent describes the respondent. Falls back to the id, so an unknown segment cannot crash a session. */
export function segmentLabel(study: StudyConfig, segment: Outcome): string {
  return study.segments.find((s) => s.id === segment)?.label ?? segment;
}

/** The short segment name on the transcript page. */
export function transcriptLabel(study: StudyConfig, segment: Outcome): string {
  return study.segments.find((s) => s.id === segment)?.transcriptLabel ?? segment;
}

/** The respondent-facing sentences with their defaults. A study overrides any of them. */
export function copyFor(study: StudyConfig) {
  return {
    qualified:
      study.copy?.qualified ??
      "Next is a short voice interview, around 10 to 15 minutes. You'll need a microphone and a quiet spot. If you leave partway through, you can pick up where you stopped.",
    screenedOut:
      study.copy?.screenedOut ??
      "This study is looking for a specific group of people, and your answers put you outside it. Your responses have been recorded, and there's nothing more to do.",
    interviewHeading: study.copy?.interviewHeading ?? "A short conversation.",
    interviewBody:
      study.copy?.interviewBody ??
      "A moderator will ask {total} questions — about 10 to 15 minutes. Find a quiet spot; you can pause and come back at any time without losing your place.",
  };
}
