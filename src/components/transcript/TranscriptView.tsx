"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { loadOrCreateRespondent } from "@/lib/client/respondent";
import { fetchTranscript, type TranscriptResponse } from "@/lib/client/interview";
import { StudyShell } from "@/components/layout/StudyShell";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Notice } from "@/components/ui/Notice";

const SEGMENT_LABEL = {
  bmw_customer: "BMW Customer",
  potential_bmw_customer: "Potential BMW Customer",
} as const;

/**
 * The stored transcript, stitched from every conversation segment in order.
 * Segments still processing at ElevenLabs are polled until they arrive.
 */
export function TranscriptView() {
  const router = useRouter();
  const [data, setData] = useState<TranscriptResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    () =>
      loadTranscriptForVisitor().then(
        (result) => {
          if (result.redirect) router.replace(result.redirect);
          else if (result.data) setData(result.data);
        },
        () => setFailed(true),
      ),
    [router],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const pending = data?.segments.some((s) => s.turns === null) ?? false;
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [pending, load]);

  const turns = data?.segments.flatMap((s) => s.turns ?? []) ?? [];

  return (
    <StudyShell stage="Transcript" steps={1} current={0}>
      <div className="flex flex-1 flex-col py-10">
        <div className="w-full max-w-[640px]">
          <Eyebrow className="mb-3.5">
            {data?.interviewStatus === "completed" ? "Interview complete" : "Interview in progress"}
          </Eyebrow>
          <h1 className="mb-3 font-display text-[30px] font-medium leading-[1.12] tracking-[-0.015em] text-balance md:text-[40px] md:leading-[1.1]">
            Your interview transcript
          </h1>
          {data && (
            <p className="mb-8 font-mono text-[12px] text-muted">
              {data.segment ? SEGMENT_LABEL[data.segment] : ""} · {data.segments.length} session
              {data.segments.length === 1 ? "" : "s"} · {turns.length} turns
            </p>
          )}

          {failed && <Notice title="Couldn't load the transcript" body="Reload the page to try again." />}

          {data && data.interviewStatus !== "completed" && (
            <div className="mb-8">
              <Button onClick={() => router.push("/interview")}>Resume interview</Button>
            </div>
          )}

          {data && (
            <div className="mb-8 flex flex-wrap items-center gap-2">
              <Button variant="quiet" onClick={() => download(data, "txt")} disabled={turns.length === 0}>
                Download .txt
              </Button>
              <Button variant="quiet" onClick={() => download(data, "json")} disabled={turns.length === 0}>
                Download .json
              </Button>
            </div>
          )}

          {data?.segments.map((seg) => (
            <section key={seg.conversationId} className="mb-10">
              <div className="mb-4 flex items-center gap-3 border-b border-line pb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                <span>Session {seg.attemptNo}</span>
                <span className="text-faint">·</span>
                <span>{new Date(seg.startedAt).toLocaleString()}</span>
                {seg.endReason && (
                  <>
                    <span className="text-faint">·</span>
                    <span>{seg.endReason === "dropped" ? "connection lost" : seg.endReason.replace("_", " ")}</span>
                  </>
                )}
              </div>
              {seg.turns === null ? (
                <p className="text-[15px] text-muted">Still processing at ElevenLabs — this refreshes on its own.</p>
              ) : seg.turns.length === 0 ? (
                <p className="text-[15px] text-muted">No speech was recorded in this session.</p>
              ) : (
                <ol className="flex flex-col gap-4">
                  {seg.turns.map((t, i) => (
                    <li key={i} className="grid grid-cols-[72px_1fr] gap-4">
                      <span className={cn("pt-0.5 font-mono text-[11px] uppercase tracking-[0.1em]", t.role === "agent" ? "text-accent" : "text-muted")}>
                        {t.role === "agent" ? "Moderator" : "You"}
                      </span>
                      <p className="text-[16px] leading-7 text-text">{t.message}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      </div>
    </StudyShell>
  );
}

type VisitorTranscript = { redirect: string; data?: never } | { redirect?: never; data: TranscriptResponse };

async function loadTranscriptForVisitor(): Promise<VisitorTranscript> {
  const state = await loadOrCreateRespondent();
  if (state.surveyStatus !== "qualified") return { redirect: "/" };
  if (state.interviewStatus === "not_started") return { redirect: "/interview" };
  return { data: await fetchTranscript(state.id) };
}

function download(data: TranscriptResponse, format: "txt" | "json") {
  const body =
    format === "json"
      ? JSON.stringify(data, null, 2)
      : data.segments
          .map(
            (s) =>
              `--- Session ${s.attemptNo} · ${new Date(s.startedAt).toLocaleString()} ---\n` +
              (s.turns ?? []).map((t) => `${t.role === "agent" ? "Moderator" : "Respondent"}: ${t.message}`).join("\n"),
          )
          .join("\n\n");
  const blob = new Blob([body], { type: format === "json" ? "application/json" : "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `soundings-transcript-${data.respondentId.slice(0, 8)}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
