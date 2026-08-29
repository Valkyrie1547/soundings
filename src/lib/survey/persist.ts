import { eq } from "drizzle-orm";
import { db } from "@/db";
import { respondents, surveyAnswers } from "@/db/schema";
import { study } from "@/config/study";
import { resolve, type Answers } from "./engine";

export interface RespondentState {
  id: string;
  surveyStatus: "in_progress" | "screened_out" | "qualified";
  segment: "bmw_customer" | "potential_bmw_customer" | null;
  interviewStatus: "not_started" | "in_progress" | "completed";
  answers: Answers;
}

export async function createRespondent(): Promise<RespondentState> {
  const [row] = await db().insert(respondents).values({}).returning();
  return { ...pick(row), answers: {} };
}

export async function loadRespondent(id: string): Promise<RespondentState | null> {
  const [row] = await db().select().from(respondents).where(eq(respondents.id, id));
  if (!row) return null;
  const rows = await db()
    .select({ questionId: surveyAnswers.questionId, answer: surveyAnswers.answer })
    .from(surveyAnswers)
    .where(eq(surveyAnswers.respondentId, id));
  const answers: Answers = Object.fromEntries(rows.map((r) => [r.questionId, r.answer]));
  return { ...pick(row), answers };
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

  return { ...pick(row), answers };
}

function pick(row: typeof respondents.$inferSelect) {
  return {
    id: row.id,
    surveyStatus: row.surveyStatus,
    segment: row.segment,
    interviewStatus: row.interviewStatus,
  };
}
