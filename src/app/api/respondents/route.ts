import { createRespondent } from "@/lib/survey/persist";

/** Makes a new respondent id. The client calls this once for each browser, on the first visit. */
export async function POST() {
  const state = await createRespondent();
  return Response.json(state, { status: 201 });
}
