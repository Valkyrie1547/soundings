import { loadRespondent } from "@/lib/survey/persist";
import { startInterviewSession } from "@/lib/interview/persist";
import { isUuid } from "@/lib/validate";

/** Opens a conversation segment. Returns the session row, a signed URL, and the resume context. */
export async function POST(_req: Request, ctx: RouteContext<"/api/respondents/[id]/interview/start">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Invalid respondent id" }, { status: 400 });

  const respondent = await loadRespondent(id);
  if (!respondent) return Response.json({ error: "Unknown respondent" }, { status: 404 });
  if (respondent.surveyStatus !== "qualified" || !respondent.segment) {
    return Response.json({ error: "Respondent has not qualified for the interview" }, { status: 409 });
  }
  if (respondent.interviewStatus === "completed") {
    return Response.json({ error: "Interview already completed" }, { status: 409 });
  }

  const session = await startInterviewSession(id, respondent.segment);
  return Response.json(session);
}
