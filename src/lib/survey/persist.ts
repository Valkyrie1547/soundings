import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewProgress, respondents, surveyAnswers } from "@/db/schema";
import { guideFor, type StudyConfig } from "@/lib/study";
import { loadLiveStudy, loadStudy } from "@/lib/study/registry";
import { resolve, type Answers } from "./engine";

export interface RespondentState {
  id: string;
  studyId: string;
  studyVersion: number;
  surveyStatus: "in_progress" | "screened_out" | "qualified";
  /** A segment id from the study, or null before the respondent qualifies. */
  segment: string | null;
  interviewStatus: "not_started" | "in_progress" | "completed";
  answers: Answers;
  /** The interview questions that are marked answered, in the order they were marked. */
  interviewProgress: string[];
  /** The subset of `interviewProgress` that the transcript backstop marked, not the agent. */
  transcriptConfirmed: string[];
  /** The required interview questions for this respondent's segment, in order. */
  interviewGuide: { id: string; topic: string }[];
}

/** The state together with the study version the respondent is on. Route handlers need both. */
export interface RespondentWithStudy {
  state: RespondentState;
  study: StudyConfig;
}

/** Makes a respondent on the live version of a study. Null when the study id is unknown. */
export async function createRespondent(studyId: string): Promise<RespondentState | null> {
  const study = await loadLiveStudy(studyId);
  if (!study) return null;
  const [row] = await db()
    .insert(respondents)
    .values({ studyId: study.id, studyVersion: study.version })
    .returning();
  return { ...pick(row, study), answers: {}, interviewProgress: [], transcriptConfirmed: [] };
}

export async function loadRespondent(id: string): Promise<RespondentState | null> {
  return (await loadRespondentWithStudy(id))?.state ?? null;
}

export async function loadRespondentWithStudy(id: string): Promise<RespondentWithStudy | null> {
  const [row] = await db().select().from(respondents).where(eq(respondents.id, id));
  if (!row) return null;
  const study = await loadStudy(row.studyId, row.studyVersion);
  if (!study) throw new Error(`respondent ${id} is on unknown study ${row.studyId}@${row.studyVersion}`);
  const [rows, progress] = await Promise.all([
    db()
      .select({ questionId: surveyAnswers.questionId, answer: surveyAnswers.answer })
      .from(surveyAnswers)
      .where(eq(surveyAnswers.respondentId, id)),
    db()
      .select({ questionId: interviewProgress.questionId, source: interviewProgress.source })
      .from(interviewProgress)
      .where(eq(interviewProgress.respondentId, id))
      .orderBy(asc(interviewProgress.answeredAt)),
  ]);
  const answers: Answers = Object.fromEntries(rows.map((r) => [r.questionId, r.answer]));
  const state = {
    ...pick(row, study),
    answers,
    interviewProgress: progress.map((p) => p.questionId),
    transcriptConfirmed: progress.filter((p) => p.source === "transcript").map((p) => p.questionId),
  };
  return { state, study };
}

/**
 * Saves one answer, then calculates the survey status and the segment again
 * from the full answer set. The engine decides the outcome, not the client.
 * A changed request cannot qualify itself.
 */
export async function saveAnswer(
  id: string,
  questionId: string,
  answer: string | string[],
): Promise<RespondentState | null> {
  const found = await loadRespondentWithStudy(id);
  if (!found) return null;
  const { state: existing, study } = found;
  if (existing.surveyStatus === "screened_out") return existing; // Terminal state. There is no retake.

  await db()
    .insert(surveyAnswers)
    .values({ respondentId: id, questionId, answer })
    .onConflictDoUpdate({
      target: [surveyAnswers.respondentId, surveyAnswers.questionId],
      set: { answer, answeredAt: new Date() },
    });

  const answers = { ...existing.answers, [questionId]: answer };
  const state = resolve(study, answers);
  const [row] = await db()
    .update(respondents)
    .set({
      surveyStatus: state.status,
      segment: state.status === "qualified" ? state.outcome : null,
    })
    .where(eq(respondents.id, id))
    .returning();

  return {
    ...pick(row, study),
    answers,
    interviewProgress: existing.interviewProgress,
    transcriptConfirmed: existing.transcriptConfirmed,
  };
}

function pick(row: typeof respondents.$inferSelect, study: StudyConfig) {
  return {
    id: row.id,
    studyId: row.studyId,
    studyVersion: row.studyVersion,
    surveyStatus: row.surveyStatus,
    segment: row.segment,
    interviewStatus: row.interviewStatus,
    interviewGuide: row.segment
      ? guideFor(study, row.segment)
          .filter((q) => q.required)
          .map((q) => ({ id: q.id, topic: q.topic }))
      : [],
  };
}
