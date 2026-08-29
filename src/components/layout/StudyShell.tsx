import type { CSSProperties } from "react";
import { study } from "@/config/study";
import { SoundingLine } from "@/components/ui/SoundingLine";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface StudyShellProps {
  /** Right-hand header label, e.g. "Screening · 1 of 4". */
  stage: string;
  steps: number;
  current: number;
  /** Interview mode for the rail: audio-reactive weight. */
  audio?: boolean;
  children: React.ReactNode;
}

/**
 * The frame shared by the survey and the interview: study-scoped accent,
 * the sounding-line rail, and the header. Screens render inside.
 */
export function StudyShell({ stage, steps, current, audio, children }: StudyShellProps) {
  const accent = {
    "--accent-light": study.theme.accent.light,
    "--accent-dark": study.theme.accent.dark,
    "--on-accent-light": study.theme.onAccent.light,
    "--on-accent-dark": study.theme.onAccent.dark,
  } as CSSProperties;

  return (
    <div
      style={accent}
      className="study-scope grid min-h-dvh grid-cols-1 md:grid-cols-[72px_1fr]"
    >
      <aside className="hidden border-r border-line md:block" aria-hidden>
        <div className="sticky top-0 h-dvh py-[12dvh] pl-[35px] pr-[36px]">
          <SoundingLine steps={steps} current={current} audio={audio} orientation="vertical" />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col px-6 pb-6 pt-5 md:px-14 md:pb-8 md:pl-12 md:pt-7">
        <header className="flex items-center justify-between gap-4">
          <div className="font-mono text-[11px] uppercase leading-none tracking-[0.1em] text-muted">
            <span className="text-text">{study.name}</span>
            <span className="mx-2.5 text-faint">·</span>
            <span className="hidden sm:inline">{study.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase leading-none tracking-[0.1em] text-muted">
              {stage}
            </span>
            <ThemeToggle />
          </div>
        </header>

        <div className="mt-6 md:hidden">
          <SoundingLine steps={steps} current={current} audio={audio} orientation="horizontal" />
        </div>

        {children}
      </div>
    </div>
  );
}
