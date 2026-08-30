"use client";

import { motion, useReducedMotion } from "motion/react";
import { screenTransition, screenVariants, screenVariantsQuiet, type Direction } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { KeyHint } from "@/components/ui/KeyHint";

interface OutcomeScreenProps {
  outcome: "qualified" | "screened_out";
  /** The study's own body text for each outcome. */
  copy: { qualified: string; screenedOut: string };
  direction: Direction;
  /** For the qualified outcome only. Goes to the interview. */
  onContinue?: () => void;
}

function copyFor(outcome: OutcomeScreenProps["outcome"], body: OutcomeScreenProps["copy"]) {
  if (outcome === "qualified") {
    return { eyebrow: "You qualify", heading: "Thanks — you're a match for this study.", body: body.qualified, action: "Start the interview" };
  }
  return { eyebrow: "Screening complete", heading: "Thanks for your time.", body: body.screenedOut, action: null };
}

/**
 * The end of the screening, in the same frame as the questions. The
 * screened-out state is terminal. There is no retake. A new visit shows
 * this screen again.
 */
export function OutcomeScreen({ outcome, copy, direction, onContinue }: OutcomeScreenProps) {
  const quiet = useReducedMotion();
  const c = copyFor(outcome, copy);

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
