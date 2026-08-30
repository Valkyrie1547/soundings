"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { useMicLevel, type MicStatus } from "./useMicLevel";

const SEGMENTS = 12;

/** The one-line status under the button. */
function statusLabel(status: MicStatus, heard: boolean): string {
  if (status === "denied") return "Microphone blocked. Allow it in the address bar, then try again.";
  if (status !== "listening") return "Check that your microphone works before you start.";
  return heard ? "Microphone is working." : "Say a few words.";
}

/**
 * A microphone check for the pre-flight screen. The respondent starts it,
 * speaks, and sees the level. This answers "does my microphone work?" before
 * the call uses any platform minutes.
 */
export function MicMeter({ className }: { className?: string }) {
  const { status, heard, meterRef, start, stop } = useMicLevel();
  const label = statusLabel(status, heard);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-3">
        <Button variant="quiet" onClick={status === "listening" ? stop : start}>
          {status === "listening" ? "Stop test" : "Test microphone"}
        </Button>
        <span className={cn("font-mono text-[12px]", heard ? "text-accent" : "text-muted")}>{label}</span>
      </div>
      <div
        ref={(el) => {
          meterRef.current = el;
        }}
        role="img"
        aria-label={heard ? "Microphone level: sound detected" : "Microphone level"}
        className={cn("flex h-2 gap-[3px] transition-opacity duration-(--dur-micro)", status === "listening" ? "opacity-100" : "opacity-40")}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="h-full w-[10px] bg-accent transition-opacity duration-75"
            style={{ opacity: `clamp(0.12, calc((var(--mic-level, 0) * ${SEGMENTS} - ${i}) * 1), 1)` }}
          />
        ))}
      </div>
    </div>
  );
}
