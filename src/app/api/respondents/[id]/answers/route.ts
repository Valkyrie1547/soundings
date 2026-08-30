import type { Question } from "@/lib/study";
import { loadRespondentWithStudy, saveAnswer } from "@/lib/survey/persist";
import { isUuid } from "@/lib/validate";

/** True when the answer has the shape the question expects and names only its options. */
function answerFits(question: Question, answer: unknown): answer is string | string[] {
  const has = (id: unknown) => typeof id === "string" && question.options.some((o) => o.id === id);
  if (question.type === "single") return has(answer);
  return Array.isArray(answer) && answer.length > 0 && answer.every(has);
}

/** Saves one answer. Idempotent: a second answer for the same question replaces the first. */
export async function PUT(req: Request, ctx: RouteContext<"/api/respondents/[id]/answers">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Invalid respondent id" }, { status: 400 });

  const found = await loadRespondentWithStudy(id);
  if (!found) return Response.json({ error: "Unknown respondent" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { questionId?: unknown; answer?: unknown } | null;
  const question = found.study.screening.find((q) => q.id === body?.questionId);
  if (!question) return Response.json({ error: "Unknown question" }, { status: 400 });
  if (!answerFits(question, body?.answer)) {
    return Response.json({ error: "Answer does not match the question" }, { status: 400 });
  }

  const state = await saveAnswer(id, question.id, body!.answer as string | string[]);
  if (!state) return Response.json({ error: "Unknown respondent" }, { status: 404 });
  return Response.json(state);
}
