"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { screenTransition, screenVariants, screenVariantsQuiet } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { KeyHint } from "@/components/ui/KeyHint";
import { Notice } from "@/components/ui/Notice";
import { MicMeter } from "./MicMeter";

export type InterviewPhase =
  | "loading"
  | "ready" // Not started.
  | "resume" // Started before. Progress is saved.
  | "mic_denied"
  | "connecting"
  | "live"
  | "interrupted" // The connection was lost.
  | "paused" // The respondent stopped for now.
  | "incomplete"; // The call ended, but required questions remain.

interface GuideItem {
  id: string;
  topic: string;
}

/** The study's own words for the first screen. `{total}` in the body is the question count. */
export interface IntroCopy {
  interviewHeading: string;
  interviewBody: string;
}

interface InterviewScreenProps {
  phase: InterviewPhase;
  copy: IntroCopy;
  guide: GuideItem[];
  answered: string[];
  /** The answered ids that the transcript backstop marked. */
  fromTranscript: string[];
  complete: boolean;
  isSpeaking: boolean;
  connectionStatus: string;
  error: string | null;
  onBegin: () => void;
  onPause: () => void;
  onFinish: () => void;
}

/**
 * One screen with several states. The checklist shows the progress. It is
 * also the completion gate. The Finish button is enabled only when each
 * item is marked. The server checks the same set.
 */
export function InterviewScreen(props: InterviewScreenProps) {
  const quiet = useReducedMotion();
  const key = props.phase === "live" || props.phase === "connecting" ? "call" : props.phase;

  return (
    <AnimatePresence mode="wait" initial={false} custom={1}>
      <motion.section
        key={key}
        custom={1}
        variants={quiet ? screenVariantsQuiet : screenVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={screenTransition}
        className="flex flex-1 flex-col"
      >
        {key === "call" ? <Call {...props} /> : <Intro {...props} />}
      </motion.section>
    </AnimatePresence>
  );
}

/* ---------- Before a call, or between calls ---------- */

function Intro({ phase, copy: study, guide, answered, error, onBegin }: InterviewScreenProps) {
  const done = answered.filter((id) => guide.some((q) => q.id === id)).length;
  const next = guide.find((q) => !answered.includes(q.id));
  const copy = introCopy(phase, study, done, guide.length, next?.topic);

  return (
    <div className="flex flex-1 flex-col justify-center py-10">
      <div className="w-full max-w-[560px]">
        <Eyebrow className="mb-3.5">{copy.eyebrow}</Eyebrow>
        <h1 className="mb-5 font-display text-[30px] font-medium leading-[1.12] tracking-[-0.015em] text-balance md:text-[40px] md:leading-[1.1]">
          {copy.heading}
        </h1>
        <p className="mb-8 max-w-[52ch] text-[17px] leading-7 text-muted">{copy.body}</p>
        {error && <Notice title="Something went wrong" body={error} className="mb-6" />}
        {copy.action && <MicMeter className="mb-8" />}
        {copy.action && (
          <div className="flex items-center gap-3">
            <Button onClick={onBegin} autoFocus disabled={phase === "loading"}>
              {copy.action}
            </Button>
            <span className="hidden items-center gap-1.5 font-mono text-[12px] text-muted sm:flex">
              or press <KeyHint>↵</KeyHint>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function introCopy(phase: InterviewPhase, study: IntroCopy, done: number, total: number, nextTopic?: string) {
  const pickUp = nextTopic ? `We'll pick up with ${nextTopic}.` : "We'll pick up where you left off.";
  switch (phase) {
    case "ready":
      return {
        eyebrow: "Voice interview",
        heading: study.interviewHeading,
        body: study.interviewBody.replace("{total}", String(total)),
        action: "Check microphone and start",
      };
    case "resume":
      return {
        eyebrow: "Welcome back",
        heading: `You've answered ${done} of ${total} questions.`,
        body: `${pickUp} The moderator knows what you've already covered, so nothing gets asked twice.`,
        action: "Resume interview",
      };
    case "interrupted":
      return {
        eyebrow: "Connection lost",
        heading: "The call dropped, but nothing is lost.",
        body: `Your answers so far are saved — ${done} of ${total}. ${pickUp}`,
        action: "Resume interview",
      };
    case "paused":
      return {
        eyebrow: "Paused",
        heading: "Come back whenever you're ready.",
        body: `You've answered ${done} of ${total} questions. ${pickUp} This link brings you straight back here.`,
        action: "Resume interview",
      };
    case "incomplete":
      return {
        eyebrow: "Not quite finished",
        heading: "A few questions are still open.",
        body: `The call ended with ${total - done} question${total - done === 1 ? "" : "s"} unanswered. ${pickUp}`,
        action: "Resume interview",
      };
    case "mic_denied":
      return {
        eyebrow: "Microphone needed",
        heading: "The interview needs your microphone.",
        body: "Allow microphone access for this site in your browser's address bar, then try again. Nothing else is recorded.",
        action: "Try again",
      };
    default:
      return { eyebrow: "Voice interview", heading: "Loading your session…", body: "", action: null };
  }
}

/* ---------- During a call ---------- */

function Call({ phase, guide, answered, fromTranscript, complete, isSpeaking, onPause, onFinish }: InterviewScreenProps) {
  const current = guide.find((q) => !answered.includes(q.id));
  const status =
    phase === "connecting" ? "Connecting" : isSpeaking ? "Moderator is speaking" : "Listening";

  return (
    <>
      <div className="flex flex-1 flex-col justify-center py-10">
        <div className="w-full max-w-[560px]">
          <Eyebrow className="mb-3.5 flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "inline-block size-1.5 rounded-full",
                phase === "connecting" ? "bg-faint" : isSpeaking ? "bg-accent" : "bg-muted",
              )}
            />
            {status}
          </Eyebrow>
          <h1 className="mb-8 font-display text-[30px] font-medium leading-[1.12] tracking-[-0.015em] text-balance md:text-[40px] md:leading-[1.1]">
            {complete ? "That's every question." : current ? capitalize(current.topic) : "Getting started"}
          </h1>

          <ol className="flex flex-col gap-1.5" aria-label="Interview progress">
            {guide.map((q, i) => (
              <ChecklistItem
                key={q.id}
                index={i + 1}
                topic={q.topic}
                done={answered.includes(q.id)}
                now={q.id === current?.id && !complete}
                fromTranscript={fromTranscript.includes(q.id)}
              />
            ))}
          </ol>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-4">
        <span className="hidden font-mono text-[12px] text-muted sm:block">
          {complete
            ? "All questions answered — you can finish whenever the moderator wraps up."
            : `Finish unlocks after all ${guide.length} questions.`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="quiet" onClick={onPause} disabled={phase === "connecting"}>
            Pause
          </Button>
          <Button onClick={onFinish} disabled={!complete}>
            Finish interview
          </Button>
        </div>
      </footer>
    </>
  );
}

interface ChecklistItemProps {
  index: number;
  topic: string;
  done: boolean;
  now: boolean;
  fromTranscript: boolean;
}

/** One row of the checklist. A transcript-sourced tick is a hollow diamond, not a solid one. */
function ChecklistItem({ index, topic, done, now, fromTranscript }: ChecklistItemProps) {
  const confirmed = done && fromTranscript;
  return (
    <li
      className={cn(
        "flex items-center gap-3.5 py-1 text-[15px] leading-6 transition-colors duration-(--dur-micro) ease-(--ease)",
        rowStyle(done, now),
      )}
    >
      <span className="w-5 text-right font-mono text-[11px] text-faint">{index}</span>
      <span
        aria-hidden
        title={confirmed ? "Confirmed from the transcript" : undefined}
        className={cn(
          "size-2 shrink-0 transition-colors duration-(--dur-micro) ease-(--ease)",
          diamondStyle(done, now, confirmed),
        )}
        style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
      />
      <span className={cn(done && "line-through decoration-line")}>{capitalize(topic)}</span>
    </li>
  );
}

function rowStyle(done: boolean, now: boolean) {
  if (done) return "text-muted";
  return now ? "text-text" : "text-faint";
}

/** Hollow accent when the transcript confirmed it. Solid accent when the agent marked it. */
function diamondStyle(done: boolean, now: boolean, confirmed: boolean) {
  if (confirmed) return "border-2 border-accent";
  if (done) return "bg-accent";
  return now ? "border border-accent" : "border border-line";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
