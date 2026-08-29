"use client";

import { useCallback, useState } from "react";
import { AnimatePresence } from "motion/react";
import { study } from "@/config/study";
import { resolve, type Answers } from "@/lib/survey/engine";
import type { Direction } from "@/lib/motion";
import { StudyShell } from "@/components/layout/StudyShell";
import { OutcomeScreen } from "./OutcomeScreen";
import { QuestionScreen } from "./QuestionScreen";

/**
 * Drives the screening survey from answers alone. Persistence will hook in
 * at `answer` / `back`; the engine decides the screen from stored answers,
 * so a resume is just "render with the stored answers".
 */
export function SurveyFlow() {
  const [answers, setAnswers] = useState<Answers>({});
  const [direction, setDirection] = useState<Direction>(1);
  const [cursor, setCursor] = useState<number | null>(null); // set when stepping back

  const state = resolve(study, answers);
  const total = study.screening.length;

  const answer = useCallback((questionId: string, value: string | string[]) => {
    setDirection(1);
    setCursor(null);
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const back = useCallback((fromIndex: number) => {
    setDirection(-1);
    setCursor(fromIndex - 1);
  }, []);

  // Stepping back shows an already-answered question, pre-filled.
  const viewing =
    cursor !== null
      ? { status: "in_progress" as const, question: study.screening[cursor], index: cursor }
      : state;

  const current = viewing.status === "in_progress" ? viewing.index : total - 1;
  const stage =
    viewing.status === "in_progress"
      ? `Screening · ${viewing.index + 1} of ${total}`
      : "Screening · Complete";

  return (
    <StudyShell stage={stage} steps={total} current={current}>
      <AnimatePresence custom={direction} mode="wait" initial={false}>
        {viewing.status === "in_progress" ? (
          <QuestionScreen
            key={viewing.question.id}
            question={viewing.question}
            index={viewing.index}
            value={answers[viewing.question.id]}
            direction={direction}
            onAnswer={(v) => answer(viewing.question.id, v)}
            onBack={() => back(viewing.index)}
          />
        ) : (
          <OutcomeScreen
            key={viewing.status}
            outcome={viewing.status}
            direction={direction}
            onContinue={() => {
              // Hand-off to the interview lands here once Part 2 exists.
            }}
          />
        )}
      </AnimatePresence>
    </StudyShell>
  );
}
