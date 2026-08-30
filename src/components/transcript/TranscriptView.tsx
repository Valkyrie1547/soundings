"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { loadOrCreateRespondent } from "@/lib/client/respondent";
import { pathsFor } from "@/lib/client/paths";
import { fetchTranscript, type TranscriptResponse, type TranscriptSegment } from "@/lib/client/interview";
import type { TranscriptTurn } from "@/db/schema";
import type { StudyConfig } from "@/lib/study";
import { StudyShell } from "@/components/layout/StudyShell";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Notice } from "@/components/ui/Notice";

const END_REASON_LABEL = {
  completed: "completed",
  dropped: "connection lost",
  user_ended: "user ended",
} as const;

/**
 * The stored transcript. It shows every conversation segment in order.
 * The view polls the server for segments that ElevenLabs has not processed yet.
 */
export function TranscriptView({ study }: { study: StudyConfig }) {
  const router = useRouter();
  const paths = pathsFor(study.id);
  const [data, setData] = useState<TranscriptResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    () =>
      loadTranscriptForVisitor(study.id).then(
        (result) => {
          if (result.redirect) router.replace(result.redirect);
          else if (result.data) setData(result.data);
        },
        () => setFailed(true),
      ),
    [router, study.id],
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

  const turnCount = data?.segments.reduce((n, s) => n + (s.turns?.length ?? 0), 0) ?? 0;

  return (
    <StudyShell study={study} stage="Transcript" steps={1} current={0}>
      <div className="flex flex-1 flex-col py-10">
        <div className="w-full max-w-[640px]">
          <Eyebrow className="mb-3.5">
            {data?.interviewStatus === "completed" ? "Interview complete" : "Interview in progress"}
          </Eyebrow>
          <h1 className="mb-3 font-display text-[30px] font-medium leading-[1.12] tracking-[-0.015em] text-balance md:text-[40px] md:leading-[1.1]">
            Your interview transcript
          </h1>

          {failed && <Notice title="Couldn't load the transcript" body="Reload the page to try again." />}

          {data && <Actions data={data} turnCount={turnCount} onResume={() => router.push(paths.interview)} />}

          {data?.segments.map((seg) => (
            <Segment key={seg.conversationId} segment={seg} />
          ))}
        </div>
      </div>
    </StudyShell>
  );
}

/** The summary line, the resume button, and the download buttons. */
function Actions({ data, turnCount, onResume }: { data: TranscriptResponse; turnCount: number; onResume: () => void }) {
  const sessions = data.segments.length;
  return (
    <>
      <p className="mb-8 font-mono text-[12px] text-muted">
        {data.segmentLabel ?? ""} · {sessions} session{sessions === 1 ? "" : "s"} · {turnCount}{" "}
        turns
      </p>
      {data.interviewStatus !== "completed" && (
        <div className="mb-8">
          <Button onClick={onResume}>Resume interview</Button>
        </div>
      )}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <Button variant="quiet" onClick={() => download(data, "txt")} disabled={turnCount === 0}>
          Download .txt
        </Button>
        <Button variant="quiet" onClick={() => download(data, "json")} disabled={turnCount === 0}>
          Download .json
        </Button>
      </div>
    </>
  );
}

/** One conversation segment: a header line and its turns. */
function Segment({ segment }: { segment: TranscriptSegment }) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-3 border-b border-line pb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
        <span>Session {segment.attemptNo}</span>
        <span className="text-faint">·</span>
        <span>{new Date(segment.startedAt).toLocaleString()}</span>
        {segment.endReason && (
          <>
            <span className="text-faint">·</span>
            <span>{END_REASON_LABEL[segment.endReason]}</span>
          </>
        )}
      </div>
      <Turns turns={segment.turns} />
    </section>
  );
}

/** The turns of one segment, or a status message when there are none. */
function Turns({ turns }: { turns: TranscriptTurn[] | null }) {
  if (turns === null) {
    return <p className="text-[15px] text-muted">Still processing at ElevenLabs — this refreshes on its own.</p>;
  }
  if (turns.length === 0) {
    return <p className="text-[15px] text-muted">No speech was recorded in this session.</p>;
  }
  return (
    <ol className="flex flex-col gap-4">
      {turns.map((t, i) => (
        <li key={i} className="grid grid-cols-[72px_1fr] gap-4">
          <span className={cn("pt-0.5 font-mono text-[11px] uppercase tracking-[0.1em]", t.role === "agent" ? "text-accent" : "text-muted")}>
            {t.role === "agent" ? "Moderator" : "You"}
          </span>
          <p className="text-[16px] leading-7 text-text">{t.message}</p>
        </li>
      ))}
    </ol>
  );
}

type VisitorTranscript = { redirect: string; data?: never } | { redirect?: never; data: TranscriptResponse };

/** Loads the transcript for this browser's respondent. Returns a redirect when the page is not theirs to see. */
async function loadTranscriptForVisitor(studyId: string): Promise<VisitorTranscript> {
  const paths = pathsFor(studyId);
  const state = await loadOrCreateRespondent(studyId);
  if (state.surveyStatus !== "qualified") return { redirect: paths.survey };
  if (state.interviewStatus === "not_started") return { redirect: paths.interview };
  return { data: await fetchTranscript(state.id) };
}

/** Starts a browser download of the transcript as text or JSON. */
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
