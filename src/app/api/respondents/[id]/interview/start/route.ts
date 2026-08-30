import { loadRespondentWithStudy } from "@/lib/survey/persist";
import { startInterviewSession } from "@/lib/interview/persist";
import { isUuid } from "@/lib/validate";

/** Opens a conversation segment. Returns the session row, a signed URL, and the resume context. */
export async function POST(_req: Request, ctx: RouteContext<"/api/respondents/[id]/interview/start">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Invalid respondent id" }, { status: 400 });

  const found = await loadRespondentWithStudy(id);
  if (!found) return Response.json({ error: "Unknown respondent" }, { status: 404 });
  const { state, study } = found;
  if (state.surveyStatus !== "qualified" || !state.segment) {
    return Response.json({ error: "Respondent has not qualified for the interview" }, { status: 409 });
  }
  if (state.interviewStatus === "completed") {
    return Response.json({ error: "Interview already completed" }, { status: 409 });
  }

  const session = await startInterviewSession(study, id, state.segment);
  return Response.json(session);
}
