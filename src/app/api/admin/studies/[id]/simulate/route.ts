import { simulateHappyPath } from "@/lib/admin/simulate";
import { loadLiveStudy } from "@/lib/study/registry";

/** One simulation per study per minute. A refresh cannot burn credit. */
const WINDOW_MS = 60_000;
const lastRun = new Map<string, number>();

/** Runs one happy-path simulation of the live study against the real agent. Costs platform credit. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/studies/[id]/simulate">) {
  const { id } = await ctx.params;
  const study = await loadLiveStudy(id);
  if (!study) return Response.json({ error: "Unknown study" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { segment?: unknown } | null;
  const segment = body?.segment;
  if (typeof segment !== "string" || !study.segments.some((s) => s.id === segment)) {
    return Response.json({ error: "segment must name a segment of the study" }, { status: 400 });
  }

  const last = lastRun.get(id) ?? 0;
  if (Date.now() - last < WINDOW_MS) {
    return Response.json({ error: "A simulation for this study ran less than a minute ago. Wait, then try again." }, { status: 429 });
  }
  lastRun.set(id, Date.now());

  const outcome = await simulateHappyPath(study, segment);
  return Response.json(outcome);
}
