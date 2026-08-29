"use client";

import type { RespondentState } from "@/lib/survey/persist";

const KEY = "soundings:rid";
const PARAM = "rid";

/**
 * Respondent identity on the client. The id lives in localStorage and is
 * mirrored into the URL (?rid=), so a copied link resumes the same session
 * in another window — handy for demos, and honest about the trade-off:
 * this is a resumable session, not an authenticated account.
 */
function readId(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get(PARAM);
  if (fromUrl) return fromUrl;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writeId(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  const url = new URL(window.location.href);
  if (url.searchParams.get(PARAM) !== id) {
    url.searchParams.set(PARAM, id);
    window.history.replaceState(null, "", url);
  }
}

/** Resolve the current respondent, creating one on first visit. */
export async function loadOrCreateRespondent(): Promise<RespondentState> {
  const id = readId();
  if (id) {
    const res = await fetch(`/api/respondents/${id}`, { cache: "no-store" });
    if (res.ok) {
      const state = (await res.json()) as RespondentState;
      writeId(state.id);
      return state;
    }
    if (res.status !== 404 && res.status !== 400) throw new Error(`Load failed (${res.status})`);
    // Unknown id (e.g. a stale link): fall through and start fresh.
  }
  const res = await fetch("/api/respondents", { method: "POST" });
  if (!res.ok) throw new Error(`Create failed (${res.status})`);
  const state = (await res.json()) as RespondentState;
  writeId(state.id);
  return state;
}

export async function saveAnswer(
  id: string,
  questionId: string,
  answer: string | string[],
): Promise<RespondentState> {
  const res = await fetch(`/api/respondents/${id}/answers`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ questionId, answer }),
  });
  if (!res.ok) throw new Error(`Save failed (${res.status})`);
  return (await res.json()) as RespondentState;
}
