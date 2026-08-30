import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  interviewProgress,
  interviewSessions,
  respondents,
  transcripts,
  type TranscriptTurn,
} from "@/db/schema";
import { guideFor, isComplete, requiredIds, type Outcome, type StudyConfig } from "@/lib/study";
import { agentId, elevenlabs } from "@/lib/elevenlabs";
import { findUnmarkedAnswers } from "./backstop";
import { buildDynamicVariables, type ProgressEntry } from "./session";

export async function loadProgress(respondentId: string): Promise<ProgressEntry[]> {
  const rows = await db()
    .select({
      questionId: interviewProgress.questionId,
      summary: interviewProgress.summary,
      source: interviewProgress.source,
    })
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
export async function startInterviewSession(study: StudyConfig, respondentId: string, segment: Outcome) {
  // A transcript that ElevenLabs processed after the last `end` gets its backstop here.
  await applyBackstop(study, respondentId, segment, null);
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
    dynamicVariables: buildDynamicVariables(study, respondentId, segment, progress, attemptNo),
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

/** The completion gate. It reads the progress table and nothing else. */
async function evaluateGate(study: StudyConfig, respondentId: string, segment: Outcome) {
  const progress = await loadProgress(respondentId);
  const complete = isComplete(study, segment, new Set(progress.map((p) => p.questionId)));
  return { complete, progress };
}

/** The gate, then the backstop when the gate says "incomplete", then the gate again. */
async function gateWithBackstop(
  study: StudyConfig,
  respondentId: string,
  segment: Outcome,
  conversationId: string | null,
  deps: BackstopDeps,
) {
  const gate = await evaluateGate(study, respondentId, segment);
  if (gate.complete || !conversationId) return { ...gate, backstop: [] as string[] };
  const backstop = await applyBackstop(study, respondentId, segment, conversationId, deps);
  const after = backstop.length > 0 ? await evaluateGate(study, respondentId, segment) : gate;
  return { ...after, backstop };
}

/**
 * Closes a segment. The server decides completion here, from the progress
 * table. It does not trust what the client reports. When the gate says
 * "incomplete", the transcript backstop gets a second opinion. The `deps`
 * parameter is a seam for tests only.
 */
export async function endInterviewSession(
  study: StudyConfig,
  respondentId: string,
  segment: Outcome,
  sessionId: string,
  conversationId: string | null,
  reason: "completed" | "dropped" | "user_ended",
  deps: BackstopDeps = defaultBackstopDeps,
) {
  await db()
    .update(interviewSessions)
    .set({ endedAt: new Date(), endReason: reason, conversationId })
    .where(and(eq(interviewSessions.id, sessionId), eq(interviewSessions.respondentId, respondentId)));

  const result = await gateWithBackstop(study, respondentId, segment, conversationId, deps);
  if (result.complete) {
    await db()
      .update(respondents)
      .set({ interviewStatus: "completed" })
      .where(eq(respondents.id, respondentId));
  }
  return result;
}

/** The I/O that the backstop needs. Tests replace it. Production uses the defaults. */
export interface BackstopDeps {
  loadTranscript: typeof loadTranscript;
  /** Inserts one transcript-sourced row. It must not overwrite a row that exists. */
  insert: (respondentId: string, questionId: string, summary: string) => Promise<void>;
}

async function insertFromTranscript(respondentId: string, questionId: string, summary: string) {
  await db()
    .insert(interviewProgress)
    .values({ respondentId, questionId, summary, source: "transcript" })
    .onConflictDoNothing();
}

const defaultBackstopDeps: BackstopDeps = {
  loadTranscript: (respondentId) => loadTranscript(respondentId),
  insert: insertFromTranscript,
};

/** Scans each transcript in order. An id found in one segment is not scanned again in the next. */
async function insertCandidates(
  study: StudyConfig,
  respondentId: string,
  segment: Outcome,
  missing: string[],
  transcripts: TranscriptTurn[][],
  insert: BackstopDeps["insert"],
): Promise<string[]> {
  const inserted: string[] = [];
  for (const turns of transcripts) {
    const open = missing.filter((id) => !inserted.includes(id));
    for (const c of findUnmarkedAnswers(guideFor(study, segment), open, turns)) {
      await insert(respondentId, c.questionId, c.summary);
      console.log(`backstop: ${c.questionId} from transcript, respondent ${respondentId}`);
      inserted.push(c.questionId);
    }
  }
  return inserted;
}

/**
 * Reads the stored transcripts for evidence that a missing question was
 * asked and answered. It inserts a progress row for each match. Pass a
 * `conversationId` to scan one segment only. Pass null to scan every
 * closed segment. It never runs when the gate is already complete. It
 * never throws: a failure returns an empty list and the gate result stands.
 */
export async function applyBackstop(
  study: StudyConfig,
  respondentId: string,
  segment: Outcome,
  conversationId: string | null,
  deps: BackstopDeps = defaultBackstopDeps,
): Promise<string[]> {
  try {
    const answered = new Set((await loadProgress(respondentId)).map((p) => p.questionId));
    const missing = requiredIds(study, segment).filter((id) => !answered.has(id));
    if (missing.length === 0) return [];

    const transcripts = (await deps.loadTranscript(respondentId))
      .filter((s) => conversationId === null || s.conversationId === conversationId)
      .flatMap((s) => (s.turns ? [s.turns] : []));
    return await insertCandidates(study, respondentId, segment, missing, transcripts, deps.insert);
  } catch {
    return []; // The gate result stands. The next `start` tries again.
  }
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
