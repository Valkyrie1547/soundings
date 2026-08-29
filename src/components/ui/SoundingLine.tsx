import { cn } from "@/lib/cn";

type Orientation = "vertical" | "horizontal";

interface SoundingLineProps {
  /** The total number of marks on the line. */
  steps: number;
  /** The 0-based mark where the respondent is. */
  current: number;
  orientation?: Orientation;
  /**
   * Interview mode. The weight becomes larger with the moderator's voice.
   * A halo shows the respondent's microphone level.
   * CSS reads --agent-level and --mic-level for this.
   */
  audio?: boolean;
  className?: string;
}

/** The position of mark `i` along the line, as a percentage. */
function positionOf(i: number, steps: number): number {
  return steps > 1 ? (i / (steps - 1)) * 100 : 0;
}

/** One mark on the line: a short tick and its number. */
function Mark({ index, current, steps, vertical }: { index: number; current: number; steps: number; vertical: boolean }) {
  const at = positionOf(index, steps);
  const reached = index <= current;
  return (
    <div
      aria-hidden
      className="absolute"
      style={vertical ? { top: `${at}%`, left: "50%" } : { left: `${at}%`, top: "50%" }}
    >
      <span
        className={cn(
          "absolute block bg-line transition-colors duration-(--dur-screen) ease-(--ease)",
          vertical ? "-left-[7px] top-0 h-px w-[15px]" : "-top-[7px] left-0 h-[15px] w-px",
          reached && "bg-accent",
        )}
      />
      <span
        className={cn(
          "absolute font-mono text-[10px] leading-none transition-colors duration-(--dur-screen) ease-(--ease)",
          vertical ? "-left-[22px] -top-[5px]" : "-top-[22px] -left-[3px]",
          index === current ? "text-accent" : "text-faint",
        )}
      >
        {index + 1}
      </span>
    </div>
  );
}

/** The plumb weight at the current mark. In audio mode it also shows a microphone halo. */
function Weight({ pct, vertical, audio }: { pct: number; vertical: boolean; audio: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute size-[9px] transition-[top,left] duration-(--dur-screen) ease-(--ease)"
      style={
        vertical
          ? { left: "calc(50% - 4px)", top: `calc(${pct}% - 4px)` }
          : { top: "calc(50% - 4px)", left: `calc(${pct}% - 4px)` }
      }
    >
      {audio && (
        <span
          className="absolute -inset-2 rounded-full border border-accent/40"
          style={{
            transform: "scale(calc(1 + var(--mic-level, 0) * 1.4))",
            opacity: "calc(0.25 + var(--mic-level, 0))",
          }}
        />
      )}
      <span
        className="absolute inset-0 bg-accent"
        style={{
          clipPath: "polygon(50% 0, 100% 40%, 50% 100%, 0 40%)",
          transform: audio ? "scale(calc(1 + var(--agent-level, 0) * 1.8))" : undefined,
        }}
      />
    </span>
  );
}

/**
 * The signature element. A sounding line has one mark for each step.
 * The accent part of the line grows as the respondent goes deeper.
 * The plumb weight is at the current mark.
 */
export function SoundingLine({
  steps,
  current,
  orientation = "vertical",
  audio = false,
  className,
}: SoundingLineProps) {
  const clamped = Math.min(Math.max(current, 0), steps - 1);
  const pct = positionOf(clamped, steps);
  const vertical = orientation === "vertical";

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={steps}
      aria-valuenow={clamped + 1}
      aria-label={`Step ${clamped + 1} of ${steps}`}
      className={cn("relative", vertical ? "h-full w-full" : "h-6 w-full", className)}
    >
      {/* The full line, then the part that is paid out. */}
      <div
        aria-hidden
        className={cn(
          "absolute bg-line",
          vertical ? "left-1/2 top-0 h-full w-px" : "top-1/2 left-0 h-px w-full",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "absolute bg-accent transition-[height,width] duration-(--dur-screen) ease-(--ease)",
          vertical ? "left-1/2 top-0 w-px" : "top-1/2 left-0 h-px",
        )}
        style={vertical ? { height: `${pct}%` } : { width: `${pct}%` }}
      />

      {Array.from({ length: steps }, (_, i) => (
        <Mark key={i} index={i} current={clamped} steps={steps} vertical={vertical} />
      ))}

      <Weight pct={pct} vertical={vertical} audio={audio} />
    </div>
  );
}
