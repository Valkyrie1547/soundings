import { parseStudy } from "@/lib/study";
import { publishStudy } from "@/lib/study/registry";

/**
 * Publishes a study. The document must validate first. The registry
 * assigns the next version, so the `version` in the body cannot overwrite
 * a version a respondent is using.
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = JSON.parse((await req.text()) || "");
  } catch {
    return Response.json({ error: "The body is not JSON" }, { status: 400 });
  }
  const result = parseStudy(json);
  if (!result.study) return Response.json({ error: "The study does not validate", issues: result.issues }, { status: 400 });

  const published = await publishStudy(result.study);
  if (!published.ok) return Response.json({ error: "This content is already the live version" }, { status: 409 });
  return Response.json({ id: result.study.id, version: published.version }, { status: 201 });
}
