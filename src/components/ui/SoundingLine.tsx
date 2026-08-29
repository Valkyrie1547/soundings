import { cn } from "@/lib/cn";

interface SoundingLineProps {
  /** Total marks on the line. */
  steps: number;
  /** 0-based mark the respondent is at. */
  current: number;
  orientation?: "vertical" | "horizontal";
  /**
   * Interview mode: the weight swells with the moderator's voice and a
   * halo tracks the respondent's mic, via --agent-level / --mic-level.
   */
  audio?: boolean;
  className?: string;
}

/**
 * The signature element: a sounding line with one mark per step, paid out
 * as the respondent goes deeper. The plumb weight sits at the current mark.
 */
export function SoundingLine({
  steps,
  current,
  orientation = "vertical",
  audio = false,
  className,
}: SoundingLineProps) {
  const clamped = Math.min(Math.max(current, 0), steps - 1);
  const pct = steps > 1 ? (clamped / (steps - 1)) * 100 : 0;
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
      {/* the line, and the portion paid out */}
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

      {/* marks */}
      {Array.from({ length: steps }, (_, i) => {
        const at = steps > 1 ? (i / (steps - 1)) * 100 : 0;
        const reached = i <= clamped;
        return (
          <div
            key={i}
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
                i === clamped ? "text-accent" : "text-faint",
              )}
            >
              {i + 1}
            </span>
          </div>
        );
      })}

      {/* the weight, with a mic halo in audio mode */}
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
    </div>
  );
}
