import { createRespondent } from "@/lib/survey/persist";

/** Makes a new respondent on the live version of one study. The client calls this once for each browser and study. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { studyId?: unknown } | null;
  const studyId = body?.studyId;
  if (typeof studyId !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(studyId)) {
    return Response.json({ error: "studyId is required" }, { status: 400 });
  }
  const state = await createRespondent(studyId);
  if (!state) return Response.json({ error: "Unknown study" }, { status: 404 });
  return Response.json(state, { status: 201 });
}
