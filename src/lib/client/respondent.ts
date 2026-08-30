"use client";

import type { RespondentState } from "@/lib/survey/persist";

const KEY_PREFIX = "soundings:rid";
const PARAM = "rid";

/** One storage key for each study, so two studies in one browser do not share a respondent. */
function storageKey(studyId: string) {
  return `${KEY_PREFIX}:${studyId}`;
}

/**
 * The respondent identity on the client. The id is in localStorage and also
 * in the URL (?rid=). A copied link resumes the same session in a different
 * window. This is a resumable session, not an authenticated account.
 */
function readId(studyId: string): string | null {
  const params = new URLSearchParams(window.location.search);
  // ?new=1 makes a new respondent. Use it for demos and tests.
  if (params.has("new")) return null;
  const fromUrl = params.get(PARAM);
  if (fromUrl) return fromUrl;
  try {
    return localStorage.getItem(storageKey(studyId));
  } catch {
    return null;
  }
}

function writeId(studyId: string, id: string) {
  try {
    localStorage.setItem(storageKey(studyId), id);
  } catch {}
  const url = new URL(window.location.href);
  if (url.searchParams.get(PARAM) !== id || url.searchParams.has("new")) {
    url.searchParams.set(PARAM, id);
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url);
  }
}

// The load that is in progress now. React StrictMode runs a mount effect twice
// in development. Without this, two loads with ?new=1 make two respondents.
let inflight: Promise<RespondentState> | null = null;

/** Gets the current respondent of one study. Creates one on the first visit. Parallel calls share one request. */
export function loadOrCreateRespondent(studyId: string): Promise<RespondentState> {
  if (!inflight) {
    inflight = load(studyId).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** A stored id that belongs to a different study is ignored. The visitor gets a new respondent for this study. */
async function loadExisting(studyId: string, id: string): Promise<RespondentState | null> {
  const res = await fetch(`/api/respondents/${id}`, { cache: "no-store" });
  if (res.ok) {
    const state = (await res.json()) as RespondentState;
    return state.studyId === studyId ? state : null;
  }
  if (res.status !== 404 && res.status !== 400) throw new Error(`Load failed (${res.status})`);
  return null; // The id is unknown, for example from an old link. Continue and start new.
}

async function load(studyId: string): Promise<RespondentState> {
  const id = readId(studyId);
  const existing = id ? await loadExisting(studyId, id) : null;
  if (existing) {
    writeId(studyId, existing.id);
    return existing;
  }
  const res = await fetch("/api/respondents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ studyId }),
  });
  if (!res.ok) throw new Error(`Create failed (${res.status})`);
  const state = (await res.json()) as RespondentState;
  writeId(studyId, state.id);
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
