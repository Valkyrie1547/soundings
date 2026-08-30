"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Notice } from "@/components/ui/Notice";
import { guideFor, type StudyConfig } from "@/lib/study";
import { useStudyEditor } from "./useStudyEditor";

/**
 * The study editor: a JSON document, three actions, and a live-agent
 * check. Validate and Publish use the admin API. Preview renders what a
 * respondent and the agent would get, from the same schema and helpers as
 * the live pages.
 */
export function StudyEditor({ initialJson }: { initialJson: string }) {
  const editor = useStudyEditor(initialJson);

  return (
    <div className="flex flex-1 flex-col gap-6 py-10">
      <div className="w-full max-w-[720px]">
        <Eyebrow className="mb-3.5">
          <Link href="/admin" className="hover:text-text">
            ← All studies
          </Link>
        </Eyebrow>
        <textarea
          value={editor.text}
          onChange={(e) => editor.setText(e.target.value)}
          spellCheck={false}
          rows={24}
          className="w-full resize-y rounded-control border border-line bg-surface p-4 font-mono text-[13px] leading-5 text-text outline-none focus:border-accent"
          aria-label="Study document"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="quiet" onClick={editor.validate} disabled={editor.busy !== null}>
            Validate
          </Button>
          <Button variant="quiet" onClick={editor.showPreview} disabled={editor.busy !== null}>
            Preview
          </Button>
          <Button onClick={editor.publish} disabled={editor.busy !== null}>
            {editor.busy === "publish" ? "Publishing…" : "Publish"}
          </Button>
        </div>

        {editor.message && <Notice title={editor.message} className="mt-4" />}
        {editor.issues && editor.issues.length > 0 && <IssueList issues={editor.issues} />}
      </div>

      {editor.preview && <Preview study={editor.preview} />}
      {editor.preview && (
        <SimulatePanel
          study={editor.preview}
          busy={editor.busy === "simulate"}
          outcome={editor.simulation}
          onRun={(segment) => editor.simulate(editor.preview!.id, segment)}
        />
      )}
    </div>
  );
}

function IssueList({ issues }: { issues: { path: string; message: string }[] }) {
  return (
    <ul className="mt-4 flex max-w-[720px] flex-col gap-1 font-mono text-[13px]">
      {issues.map((i, n) => (
        <li key={n} className="text-text">
          <span className="text-accent">{i.path || "(root)"}</span> — {i.message}
        </li>
      ))}
    </ul>
  );
}

/** What a respondent and the agent get: the screening flow and the guide per segment. Read only. */
function Preview({ study }: { study: StudyConfig }) {
  return (
    <div className="w-full max-w-[720px] border-t border-line pt-6">
      <Eyebrow className="mb-4">Preview — screening</Eyebrow>
      {study.screening.map((q, i) => (
        <div key={q.id} className="mb-5">
          <p className="mb-1.5 text-[16px] font-medium text-text">
            {i + 1}. {q.prompt}
            <span className="ml-2 font-mono text-[11px] text-muted">{q.type === "multi" ? "multi" : "single"}</span>
          </p>
          <ul className="flex flex-col gap-0.5 text-[14px] text-muted">
            {q.options.map((o) => (
              <li key={o.id}>
                {o.label}
                {o.effect && (
                  <span className="ml-2 font-mono text-[11px] text-accent">
                    {o.effect.kind === "terminate" ? "screens out" : `→ ${o.effect.outcome}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {study.segments.map((s) => (
        <div key={s.id} className="mb-5">
          <Eyebrow className="mb-2">
            Preview — interview guide for {s.label} ({s.id})
          </Eyebrow>
          <ol className="flex flex-col gap-1 text-[14px] leading-6 text-muted">
            {guideFor(study, s.id).map((q) => (
              <li key={`${q.id}-${q.audience}`}>
                <span className="font-mono text-[11px] text-faint">[{q.id}]</span> {q.text}
                {!q.required && <span className="ml-2 font-mono text-[11px] text-faint">not required</span>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

interface SimulatePanelProps {
  study: StudyConfig;
  busy: boolean;
  outcome: import("@/lib/admin/simulate").SimulationOutcome | null;
  onRun: (segment: string) => void;
}

/** Runs one live simulation of the published study. The credit note shows before the button runs. */
function SimulatePanel({ study, busy, outcome, onRun }: SimulatePanelProps) {
  const [segment, setSegment] = useState(study.segments[0].id);
  return (
    <div className="w-full max-w-[720px] border-t border-line pt-6">
      <Eyebrow className="mb-2">Try the agent</Eyebrow>
      <p className="mb-3 max-w-[60ch] text-[14px] leading-6 text-muted">
        Runs one simulated happy-path interview of the <em>published</em> version against the live agent. Uses
        ElevenLabs credit. Publish first; one run per study per minute.
      </p>
      <div className="mb-4 flex items-center gap-2">
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className="h-9 rounded-control border border-line bg-surface px-3 text-[14px] text-text"
          aria-label="Segment"
        >
          {study.segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <Button onClick={() => onRun(segment)} disabled={busy}>
          {busy ? "Simulating…" : "Run simulation"}
        </Button>
      </div>
      {outcome && <SimulationResult outcome={outcome} />}
    </div>
  );
}

function SimulationResult({ outcome }: { outcome: import("@/lib/admin/simulate").SimulationOutcome }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[13px]">
        <span className={outcome.pass ? "text-accent" : "text-text"}>{outcome.pass ? "PASS" : "FAIL"}</span>
        {" · "}marked {outcome.markedIds.join(", ") || "nothing"} · expected {outcome.expectedIds.join(", ")} ·{" "}
        {outcome.finishCalls} finish call{outcome.finishCalls === 1 ? "" : "s"} · {outcome.turns.length} turns
      </p>
      <ol className="flex max-h-80 flex-col gap-2 overflow-y-auto border border-line p-3 text-[13px] leading-5">
        {outcome.turns.map((t, i) => (
          <li key={i} className="grid grid-cols-[80px_1fr] gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              {t.role === "agent" ? "Moderator" : "Respondent"}
            </span>
            <span className="text-text">{t.message}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
