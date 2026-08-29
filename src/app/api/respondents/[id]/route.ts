import { loadRespondent } from "@/lib/survey/persist";
import { isUuid } from "@/lib/validate";

/** Everything the client needs to render the right screen for this respondent. */
export async function GET(_req: Request, ctx: RouteContext<"/api/respondents/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Invalid respondent id" }, { status: 400 });

  const state = await loadRespondent(id);
  if (!state) return Response.json({ error: "Unknown respondent" }, { status: 404 });
  return Response.json(state);
}
