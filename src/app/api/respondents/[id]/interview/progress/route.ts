import { loadRespondent } from "@/lib/survey/persist";
import { markAnswered } from "@/lib/interview/persist";
import { requiredIds } from "@/lib/interview/session";
import { isUuid } from "@/lib/validate";

/** The agent (via a client tool) says a question was answered. */
export async function POST(req: Request, ctx: RouteContext<"/api/respondents/[id]/interview/progress">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Invalid respondent id" }, { status: 400 });

  const respondent = await loadRespondent(id);
  if (!respondent?.segment) return Response.json({ error: "Unknown respondent" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { questionId?: unknown; summary?: unknown } | null;
  const questionId = body?.questionId;
  if (typeof questionId !== "string" || !requiredIds(respondent.segment).includes(questionId)) {
    return Response.json({ error: "Unknown question for this segment" }, { status: 400 });
  }
  const summary = typeof body?.summary === "string" ? body.summary.slice(0, 500) : null;

  const progress = await markAnswered(id, questionId, summary);
  return Response.json({ progress });
}
