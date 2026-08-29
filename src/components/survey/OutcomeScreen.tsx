"use client";

import { motion, useReducedMotion } from "motion/react";
import { screenTransition, screenVariants, screenVariantsQuiet, type Direction } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { KeyHint } from "@/components/ui/KeyHint";

interface OutcomeScreenProps {
  outcome: "qualified" | "screened_out";
  direction: Direction;
  /** Qualified only: hands off to the interview. */
  onContinue?: () => void;
}

const copy = {
  qualified: {
    eyebrow: "You qualify",
    heading: "Thanks — you're a match for this study.",
    body:
      "Next is a short voice interview about your ownership experience, around 10 to 15 minutes. You'll need a microphone and a quiet spot. If you leave partway through, you can pick up where you stopped.",
    action: "Start the interview",
  },
  screened_out: {
    eyebrow: "Screening complete",
    heading: "Thanks for your time.",
    body:
      "This study is looking for a specific group of drivers, and your answers put you outside it. Your responses have been recorded, and there's nothing more to do.",
    action: null,
  },
} as const;

/**
 * The end of screening, in the same frame as the questions. Screened-out
 * is terminal: there is no retake, and revisiting shows this screen again.
 */
export function OutcomeScreen({ outcome, direction, onContinue }: OutcomeScreenProps) {
  const quiet = useReducedMotion();
  const c = copy[outcome];

  return (
    <motion.section
      key={outcome}
      custom={direction}
      variants={quiet ? screenVariantsQuiet : screenVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={screenTransition}
      className="flex flex-1 flex-col"
    >
      <div className="flex flex-1 flex-col justify-center py-10">
        <div className="w-full max-w-[560px]">
          <Eyebrow className="mb-3.5">{c.eyebrow}</Eyebrow>
          <h1 className="mb-5 font-display text-[30px] font-medium leading-[1.12] tracking-[-0.015em] text-balance md:text-[40px] md:leading-[1.1]">
            {c.heading}
          </h1>
          <p className="mb-8 max-w-[52ch] text-[17px] leading-7 text-muted">{c.body}</p>
          {c.action && onContinue && (
            <div className="flex items-center gap-3">
              <Button onClick={onContinue} autoFocus>
                {c.action}
              </Button>
              <span className="hidden items-center gap-1.5 font-mono text-[12px] text-muted sm:flex">
                or press <KeyHint>↵</KeyHint>
              </span>
            </div>
          )}
        </div>
      </div>
      <footer className="h-9" aria-hidden />
    </motion.section>
  );
}
