import { interviewGuideFor, type InterviewQuestion, type Outcome } from "@/config/study";
import type { DynamicVariables } from "./agent-config";

export interface ProgressEntry {
  questionId: string;
  summary: string | null;
}

const SEGMENT_LABEL: Record<Outcome, string> = {
  bmw_customer: "Current BMW owner",
  potential_bmw_customer: "Owner of a Mercedes-Benz or Audi",
};

/**
 * The guide a respondent hears. In short mode (development only) the
 * interview has three questions, so one full run uses about 2 platform
 * minutes instead of 12. The required set, the progress, and the completion
 * check all come from this one function. Short mode cannot disagree with
 * itself.
 */
export function guideFor(segment: Outcome): InterviewQuestion[] {
  const full = interviewGuideFor(segment);
  if (process.env.INTERVIEW_SHORT_MODE === "1") {
    return full.filter((q) => ["q1", "q2", "q3", "q12"].includes(q.id));
  }
  return full;
}

export function requiredIds(segment: Outcome): string[] {
  return guideFor(segment).filter((q) => q.required).map((q) => q.id);
}

export function isComplete(segment: Outcome, answered: Set<string>): boolean {
  return requiredIds(segment).every((id) => answered.has(id));
}

/**
 * All the data the agent needs to run or resume this respondent's
 * interview. The server builds it from the database. The prompt does not
 * change.
 */
export function buildDynamicVariables(
  respondentId: string,
  segment: Outcome,
  progress: ProgressEntry[],
): DynamicVariables {
  const guide = guideFor(segment);
  const answered = new Set(progress.map((p) => p.questionId));
  const isResume = progress.length > 0;
  const remaining = guide.filter((q) => q.required && !answered.has(q.id));

  const questionGuide = guide
    .filter((q) => q.required)
    .map((q) => `[${q.id}] ${q.text}`)
    .join("\n");

  const lastAnswered = [...guide].reverse().find((q) => answered.has(q.id));
  const lastTopic = lastAnswered?.topic ?? "";

  const priorContext = progress
    .map((p) => {
      const q = guide.find((g) => g.id === p.questionId);
      return q ? `- ${q.topic}: ${p.summary ?? "(answered)"}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const openingLine = isResume
    ? `Welcome back. Last time we were just discussing ${lastTopic}. Let's pick up from there — ready to continue?`
    : guide[0].text;

  return {
    respondent_id: respondentId,
    segment_label: SEGMENT_LABEL[segment],
    question_guide: questionGuide,
    answered_question_ids: answered.size ? [...answered].join(", ") : "none",
    remaining_count: remaining.length,
    is_resume: isResume,
    last_topic: lastTopic,
    prior_context: priorContext || "(none)",
    opening_line: openingLine,
  };
}
