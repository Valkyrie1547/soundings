import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewProgress, respondents, surveyAnswers } from "@/db/schema";
import { study } from "@/config/study";
import { guideFor } from "@/lib/interview/session";
import { resolve, type Answers } from "./engine";

export interface RespondentState {
  id: string;
  surveyStatus: "in_progress" | "screened_out" | "qualified";
  segment: "bmw_customer" | "potential_bmw_customer" | null;
  interviewStatus: "not_started" | "in_progress" | "completed";
  answers: Answers;
  /** Interview questions already marked answered, in the order they were. */
  interviewProgress: string[];
  /** The required interview questions this respondent's segment hears, in order. */
  interviewGuide: { id: string; topic: string }[];
}

export async function createRespondent(): Promise<RespondentState> {
  const [row] = await db().insert(respondents).values({}).returning();
  return { ...pick(row), answers: {}, interviewProgress: [] };
}

export async function loadRespondent(id: string): Promise<RespondentState | null> {
  const [row] = await db().select().from(respondents).where(eq(respondents.id, id));
  if (!row) return null;
  const [rows, progress] = await Promise.all([
    db()
      .select({ questionId: surveyAnswers.questionId, answer: surveyAnswers.answer })
      .from(surveyAnswers)
      .where(eq(surveyAnswers.respondentId, id)),
    db()
      .select({ questionId: interviewProgress.questionId })
      .from(interviewProgress)
      .where(eq(interviewProgress.respondentId, id))
      .orderBy(asc(interviewProgress.answeredAt)),
  ]);
  const answers: Answers = Object.fromEntries(rows.map((r) => [r.questionId, r.answer]));
  return { ...pick(row), answers, interviewProgress: progress.map((p) => p.questionId) };
}

/**
 * Upsert one answer, then re-derive the respondent's survey status and
 * segment from the full answer set. The engine — not the client — decides
 * the outcome, so a tampered request can't self-qualify.
 */
export async function saveAnswer(
  id: string,
  questionId: string,
  answer: string | string[],
): Promise<RespondentState | null> {
  const existing = await loadRespondent(id);
  if (!existing) return null;
  if (existing.surveyStatus === "screened_out") return existing; // terminal: no retake

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

  return { ...pick(row), answers, interviewProgress: existing.interviewProgress };
}

function pick(row: typeof respondents.$inferSelect) {
  return {
    id: row.id,
    surveyStatus: row.surveyStatus,
    segment: row.segment,
    interviewStatus: row.interviewStatus,
    interviewGuide: row.segment
      ? guideFor(row.segment)
          .filter((q) => q.required)
          .map((q) => ({ id: q.id, topic: q.topic }))
      : [],
  };
}
