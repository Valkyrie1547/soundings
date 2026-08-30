/** The page paths of one study. Every link and redirect goes through here. */
export function pathsFor(studyId: string) {
  const base = `/s/${studyId}`;
  return { survey: base, interview: `${base}/interview`, transcript: `${base}/transcript` };
}

/** The study a respondent id belongs to when none is given. */
export const DEFAULT_STUDY_ID = "vehicle-ownership";
