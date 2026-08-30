import { notFound, redirect } from "next/navigation";
import { DEFAULT_STUDY_ID } from "@/lib/client/paths";
import { loadLiveStudy } from "./registry";
import type { StudyConfig } from "./schema";

/** The live study for a page under `/s/[studyId]`. An unknown id is a 404. */
export async function studyForPage(studyId: string): Promise<StudyConfig> {
  const study = await loadLiveStudy(studyId);
  if (!study) notFound();
  return study;
}

type Search = Record<string, string | string[] | undefined>;

/**
 * Sends an old path (`/`, `/interview`, `/transcript`) to the default
 * study. The query string goes with it, so an old link with `?rid=` still
 * resumes the correct respondent.
 */
export function redirectToDefaultStudy(suffix: string, search: Search): never {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) {
    for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) params.append(k, one);
  }
  const query = params.toString();
  redirect(`/s/${process.env.DEFAULT_STUDY_ID ?? DEFAULT_STUDY_ID}${suffix}${query ? `?${query}` : ""}`);
}
