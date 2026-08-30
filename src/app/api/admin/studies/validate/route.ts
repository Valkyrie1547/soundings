import { parseStudy } from "@/lib/study";

/** Checks a study document. Returns the issues with dotted paths. It writes nothing. */
export async function POST(req: Request) {
  const body = (await req.text()) || "";
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (err) {
    return Response.json({ ok: false, issues: [{ path: "", message: err instanceof Error ? err.message : "not JSON" }] });
  }
  const result = parseStudy(json);
  if (result.study) return Response.json({ ok: true, issues: [] });
  return Response.json({ ok: false, issues: result.issues });
}
