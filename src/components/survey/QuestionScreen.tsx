"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Question } from "@/config/study";
import { screenTransition, screenVariants, screenVariantsQuiet, type Direction } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { KeyHint } from "@/components/ui/KeyHint";
import { Notice } from "@/components/ui/Notice";
import { QuestionRenderer } from "./QuestionRenderer";

interface QuestionScreenProps {
  question: Question;
  index: number;
  value?: string | string[];
  direction: Direction;
  /** A problem worth telling the respondent about, e.g. a failed save. */
  notice?: string | null;
  onAnswer: (value: string | string[]) => void;
  onBack?: () => void;
}

/**
 * One question, full screen. Must be rendered inside an <AnimatePresence
 * custom={direction} mode="wait"> so the outgoing question exits in the
 * same direction the incoming one enters.
 */
export function QuestionScreen({ question, index, value, direction, notice, onAnswer, onBack }: QuestionScreenProps) {
  const quiet = useReducedMotion();
  const eyebrow = question.type === "multi" ? (question.hint ?? "Select all that apply") : "Select one";
  const last = question.options.length;

  return (
    <motion.section
      key={question.id}
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
          <Eyebrow className="mb-3.5">{eyebrow}</Eyebrow>
          <h1
            id={`q-${question.id}`}
            className="mb-7 font-display text-[30px] font-medium leading-[1.12] tracking-[-0.015em] text-balance md:text-[40px] md:leading-[1.1]"
          >
            {question.prompt}
          </h1>
          <QuestionRenderer question={question} value={value} onAnswer={onAnswer} />
          {notice && <Notice title={notice} className="mt-6" />}
        </div>
      </div>

      <footer className="flex items-center justify-between gap-4">
        <div className="hidden items-center gap-5 font-mono text-[12px] text-muted sm:flex">
          <span className="flex items-center gap-1.5">
            <KeyHint>1</KeyHint>–<KeyHint>{last}</KeyHint> {question.type === "multi" ? "toggle" : "select"}
          </span>
          <span className="flex items-center gap-1.5">
            <KeyHint>↑</KeyHint><KeyHint>↓</KeyHint> move
          </span>
          <span className="flex items-center gap-1.5">
            <KeyHint>↵</KeyHint> continue
          </span>
        </div>
        <div className="ml-auto">
          {index > 0 && onBack && (
            <Button variant="quiet" onClick={onBack}>
              Back
            </Button>
          )}
        </div>
      </footer>
    </motion.section>
  );
}
