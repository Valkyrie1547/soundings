import { createRespondent } from "@/lib/survey/persist";

/** Issue a new respondent id. Called once per browser, on first visit. */
export async function POST() {
  const state = await createRespondent();
  return Response.json(state, { status: 201 });
}
