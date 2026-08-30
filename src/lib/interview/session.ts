import type { ProgressSource } from "@/db/schema";
import { guideFor, segmentLabel, type Outcome, type StudyConfig } from "@/lib/study";
import type { DynamicVariables } from "./agent-config";

export interface ProgressEntry {
  questionId: string;
  summary: string | null;
  /** "tool" when the agent marked it. "transcript" when the backstop found the answer. */
  source: ProgressSource;
}

/** The agent's first words. On a resume it greets, names the last topic when there is one, and asks to continue. */
function openingLineFor(isResume: boolean, lastTopic: string, firstQuestion: string): string {
  if (!isResume) return firstQuestion;
  if (!lastTopic) return "Welcome back. We hadn't started the questions yet, so let's begin now — ready to continue?";
  return `Welcome back. Last time we were just discussing ${lastTopic}. Let's pick up from there — ready to continue?`;
}

/**
 * All the data the agent needs to run or resume this respondent's
 * interview. The server builds it from the study and the database. The
 * prompt does not change between studies.
 */
export function buildDynamicVariables(
  study: StudyConfig,
  respondentId: string,
  segment: Outcome,
  progress: ProgressEntry[],
  attemptNo = 1,
): DynamicVariables {
  const guide = guideFor(study, segment);
  const answered = new Set(progress.map((p) => p.questionId));
  // A second session is a resume, even when no question was marked in the first one.
  const isResume = attemptNo > 1 || progress.length > 0;
  const remaining = guide.filter((q) => q.required && !answered.has(q.id));

  // "{count}" in a question text becomes the real question count for this
  // guide. The moderator then says "11 questions", not "10-15 questions",
  // and the number stays correct per segment and in short mode.
  const total = guide.filter((q) => q.required).length;
  const spoken = (text: string) => text.replaceAll("{count}", String(total));

  const questionGuide = guide
    .filter((q) => q.required)
    .map((q) => `[${q.id}] ${spoken(q.text)}`)
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

  const openingLine = openingLineFor(isResume, lastTopic, spoken(guide[0].text));

  return {
    respondent_id: respondentId,
    segment_label: segmentLabel(study, segment),
    question_guide: questionGuide,
    answered_question_ids: answered.size ? [...answered].join(", ") : "none",
    remaining_count: remaining.length,
    is_resume: isResume,
    last_topic: lastTopic,
    prior_context: priorContext || "(none)",
    opening_line: openingLine,
  };
}
