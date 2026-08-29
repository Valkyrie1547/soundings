import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  interviewProgress,
  interviewSessions,
  respondents,
  transcripts,
  type TranscriptTurn,
} from "@/db/schema";
import type { Outcome } from "@/config/study";
import { agentId, elevenlabs } from "@/lib/elevenlabs";
import { buildDynamicVariables, isComplete, type ProgressEntry } from "./session";

export async function loadProgress(respondentId: string): Promise<ProgressEntry[]> {
  const rows = await db()
    .select({ questionId: interviewProgress.questionId, summary: interviewProgress.summary })
    .from(interviewProgress)
    .where(eq(interviewProgress.respondentId, respondentId))
    .orderBy(asc(interviewProgress.answeredAt));
  return rows;
}

/**
 * Opens a new conversation segment. It makes a session row, gets a signed
 * URL, and builds the dynamic variables that tell the agent where this
 * respondent is.
 */
export async function startInterviewSession(respondentId: string, segment: Outcome) {
  const progress = await loadProgress(respondentId);
  const prior = await db()
    .select({ attemptNo: interviewSessions.attemptNo })
    .from(interviewSessions)
    .where(eq(interviewSessions.respondentId, respondentId));
  const attemptNo = prior.reduce((max, s) => Math.max(max, s.attemptNo), 0) + 1;

  const [session] = await db()
    .insert(interviewSessions)
    .values({ respondentId, attemptNo })
    .returning({ id: interviewSessions.id });

  await db()
    .update(respondents)
    .set({ interviewStatus: "in_progress" })
    .where(and(eq(respondents.id, respondentId), eq(respondents.interviewStatus, "not_started")));

  const { signedUrl } = await elevenlabs().conversationalAi.conversations.getSignedUrl({
    agentId: agentId(),
  });

  return {
    sessionId: session.id,
    attemptNo,
    signedUrl,
    dynamicVariables: buildDynamicVariables(respondentId, segment, progress, attemptNo),
    progress,
  };
}

/** Idempotent. A second mark for the same question only updates the summary. */
export async function markAnswered(respondentId: string, questionId: string, summary: string | null) {
  await db()
    .insert(interviewProgress)
    .values({ respondentId, questionId, summary })
    .onConflictDoUpdate({
      target: [interviewProgress.respondentId, interviewProgress.questionId],
      set: { summary },
    });
  return loadProgress(respondentId);
}

/**
 * Closes a segment. The server decides completion here, from the progress
 * table. It does not trust what the client reports.
 */
export async function endInterviewSession(
  respondentId: string,
  segment: Outcome,
  sessionId: string,
  conversationId: string | null,
  reason: "completed" | "dropped" | "user_ended",
) {
  await db()
    .update(interviewSessions)
    .set({ endedAt: new Date(), endReason: reason, conversationId })
    .where(and(eq(interviewSessions.id, sessionId), eq(interviewSessions.respondentId, respondentId)));

  const progress = await loadProgress(respondentId);
  const complete = isComplete(segment, new Set(progress.map((p) => p.questionId)));
  if (complete) {
    await db()
      .update(respondents)
      .set({ interviewStatus: "completed" })
      .where(eq(respondents.id, respondentId));
  }
  return { complete, progress };
}

/**
 * The full interview transcript: the turns of every segment, in order.
 * When a segment has no stored transcript, this function gets it from
 * ElevenLabs. No webhook or dashboard configuration is necessary. It is safe
 * to call this early. A segment that is not processed yet is tried again on
 * the next call.
 */
export async function loadTranscript(respondentId: string) {
  const pending = await db()
    .select({ id: interviewSessions.id, conversationId: interviewSessions.conversationId })
    .from(interviewSessions)
    .leftJoin(transcripts, eq(transcripts.conversationId, interviewSessions.conversationId))
    .where(and(eq(interviewSessions.respondentId, respondentId), isNull(transcripts.conversationId)));

  for (const s of pending) {
    if (!s.conversationId) continue;
    try {
      const convo = await elevenlabs().conversationalAi.conversations.get(s.conversationId);
      if (convo.status === "in-progress" || convo.status === "initiated") continue;
      const turns: TranscriptTurn[] = convo.transcript
        .filter((t) => t.message)
        .map((t) => ({
          role: t.role === "agent" ? "agent" : "user",
          message: t.message ?? "",
          timeInCallSecs: t.timeInCallSecs,
        }));
      await db()
        .insert(transcripts)
        .values({
          conversationId: s.conversationId,
          respondentId,
          transcript: turns,
          summary: convo.analysis?.transcriptSummary ?? null,
        })
        .onConflictDoNothing();
    } catch {
      // Try again on the next request. The UI shows "still processing".
    }
  }

  const rows = await db()
    .select({
      attemptNo: interviewSessions.attemptNo,
      startedAt: interviewSessions.startedAt,
      endReason: interviewSessions.endReason,
      conversationId: interviewSessions.conversationId,
      turns: transcripts.transcript,
      summary: transcripts.summary,
    })
    .from(interviewSessions)
    .leftJoin(transcripts, eq(transcripts.conversationId, interviewSessions.conversationId))
    .where(eq(interviewSessions.respondentId, respondentId))
    .orderBy(asc(interviewSessions.attemptNo));

  return rows
    .filter((r) => r.conversationId)
    .map((r) => ({
      attemptNo: r.attemptNo,
      startedAt: r.startedAt.toISOString(),
      endReason: r.endReason,
      conversationId: r.conversationId!,
      turns: r.turns ?? null, // null means ElevenLabs has not processed it yet.
      summary: r.summary,
    }));
}
