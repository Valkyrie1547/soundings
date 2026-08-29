import { loadRespondent } from "@/lib/survey/persist";
import { loadTranscript } from "@/lib/interview/persist";
import { isUuid } from "@/lib/validate";

/** Returns all conversation segments with their transcripts. Gets the transcripts that are not stored yet. */
export async function GET(_req: Request, ctx: RouteContext<"/api/respondents/[id]/transcript">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Invalid respondent id" }, { status: 400 });

  const respondent = await loadRespondent(id);
  if (!respondent) return Response.json({ error: "Unknown respondent" }, { status: 404 });

  const segments = await loadTranscript(id);
  return Response.json({
    respondentId: id,
    segment: respondent.segment,
    interviewStatus: respondent.interviewStatus,
    segments,
  });
}
