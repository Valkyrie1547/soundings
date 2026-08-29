"use client";

import type { DynamicVariables } from "@/lib/interview/agent-config";
import type { ProgressEntry } from "@/lib/interview/session";
import type { TranscriptTurn } from "@/db/schema";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export interface StartedSession {
  sessionId: string;
  attemptNo: number;
  signedUrl: string;
  dynamicVariables: DynamicVariables;
  progress: ProgressEntry[];
}

export function startInterview(respondentId: string) {
  return fetch(`/api/respondents/${respondentId}/interview/start`, { method: "POST" }).then((r) =>
    json<StartedSession>(r),
  );
}

export function reportProgress(respondentId: string, questionId: string, summary: string | null) {
  return fetch(`/api/respondents/${respondentId}/interview/progress`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ questionId, summary }),
  }).then((r) => json<{ progress: ProgressEntry[] }>(r));
}

export function endInterview(
  respondentId: string,
  sessionId: string,
  conversationId: string | null,
  reason: "completed" | "dropped" | "user_ended",
) {
  return fetch(`/api/respondents/${respondentId}/interview/end`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, conversationId, reason }),
    keepalive: true, // survives tab close
  }).then((r) => json<{ complete: boolean; progress: ProgressEntry[] }>(r));
}

export interface TranscriptSegment {
  attemptNo: number;
  startedAt: string;
  endReason: "completed" | "dropped" | "user_ended" | null;
  conversationId: string;
  turns: TranscriptTurn[] | null;
  summary: string | null;
}

export interface TranscriptResponse {
  respondentId: string;
  segment: "bmw_customer" | "potential_bmw_customer" | null;
  interviewStatus: "not_started" | "in_progress" | "completed";
  segments: TranscriptSegment[];
}

export function fetchTranscript(respondentId: string) {
  return fetch(`/api/respondents/${respondentId}/transcript`, { cache: "no-store" }).then((r) =>
    json<TranscriptResponse>(r),
  );
}
