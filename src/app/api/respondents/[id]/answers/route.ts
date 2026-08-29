import { study } from "@/config/study";
import { saveAnswer } from "@/lib/survey/persist";
import { isUuid } from "@/lib/validate";

/** Save one answer. Idempotent: re-sending the same question overwrites. */
export async function PUT(req: Request, ctx: RouteContext<"/api/respondents/[id]/answers">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Invalid respondent id" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as
    | { questionId?: unknown; answer?: unknown }
    | null;
  const question = study.screening.find((q) => q.id === body?.questionId);
  if (!question) return Response.json({ error: "Unknown question" }, { status: 400 });

  const answer = body!.answer;
  const valid =
    question.type === "single"
      ? typeof answer === "string" && question.options.some((o) => o.id === answer)
      : Array.isArray(answer) &&
        answer.length > 0 &&
        answer.every((a) => typeof a === "string" && question.options.some((o) => o.id === a));
  if (!valid) return Response.json({ error: "Answer does not match the question" }, { status: 400 });

  const state = await saveAnswer(id, question.id, answer as string | string[]);
  if (!state) return Response.json({ error: "Unknown respondent" }, { status: 404 });
  return Response.json(state);
}
