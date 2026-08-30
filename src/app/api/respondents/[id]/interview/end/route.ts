import { loadRespondentWithStudy } from "@/lib/survey/persist";
import { endInterviewSession } from "@/lib/interview/persist";
import { isUuid } from "@/lib/validate";

const REASONS = ["completed", "dropped", "user_ended"] as const;

/** Closes a conversation segment. The server decides if the interview is complete. */
export async function POST(req: Request, ctx: RouteContext<"/api/respondents/[id]/interview/end">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Invalid respondent id" }, { status: 400 });

  const found = await loadRespondentWithStudy(id);
  if (!found?.state.segment) return Response.json({ error: "Unknown respondent" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | { sessionId?: unknown; conversationId?: unknown; reason?: unknown }
    | null;
  const sessionId = body?.sessionId;
  const reason = body?.reason;
  if (!isUuid(sessionId) || !REASONS.includes(reason as (typeof REASONS)[number])) {
    return Response.json({ error: "sessionId and reason are required" }, { status: 400 });
  }
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;

  const result = await endInterviewSession(
    found.study,
    id,
    found.state.segment,
    sessionId,
    conversationId,
    reason as (typeof REASONS)[number],
  );
  return Response.json(result);
}
