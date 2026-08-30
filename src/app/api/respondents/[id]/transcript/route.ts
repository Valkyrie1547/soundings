import { loadRespondentWithStudy } from "@/lib/survey/persist";
import { loadTranscript } from "@/lib/interview/persist";
import { transcriptLabel } from "@/lib/study";
import { isUuid } from "@/lib/validate";

/** Returns all conversation segments with their transcripts. Gets the transcripts that are not stored yet. */
export async function GET(_req: Request, ctx: RouteContext<"/api/respondents/[id]/transcript">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Invalid respondent id" }, { status: 400 });

  const found = await loadRespondentWithStudy(id);
  if (!found) return Response.json({ error: "Unknown respondent" }, { status: 404 });
  const { state, study } = found;

  const segments = await loadTranscript(id);
  return Response.json({
    respondentId: id,
    segment: state.segment,
    segmentLabel: state.segment ? transcriptLabel(study, state.segment) : null,
    interviewStatus: state.interviewStatus,
    segments,
  });
}
