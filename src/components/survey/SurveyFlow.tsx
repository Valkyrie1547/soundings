"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { study } from "@/config/study";
import { resolve, type Answers } from "@/lib/survey/engine";
import type { Direction } from "@/lib/motion";
import { loadOrCreateRespondent, saveAnswer } from "@/lib/client/respondent";
import { StudyShell } from "@/components/layout/StudyShell";
import { Notice } from "@/components/ui/Notice";
import { OutcomeScreen } from "./OutcomeScreen";
import { QuestionScreen } from "./QuestionScreen";

type Load =
  | { status: "loading" }
  | { status: "ready"; respondentId: string }
  | { status: "failed" };

/**
 * Drives the screening survey from stored answers. On load, the server's
 * answers decide the screen — so a fresh visit, a refresh mid-survey, and a
 * return days later are all the same code path. Each answer is saved as it
 * is given; the UI advances optimistically and surfaces a save failure
 * without losing the local answer.
 */
export function SurveyFlow() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [answers, setAnswers] = useState<Answers>({});
  const [direction, setDirection] = useState<Direction>(1);
  const [cursor, setCursor] = useState<number | null>(null); // set when stepping back
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadOrCreateRespondent()
      .then((state) => {
        if (cancelled) return;
        setAnswers(state.answers);
        setLoad({ status: "ready", respondentId: state.id });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const answer = useCallback(
    (questionId: string, value: string | string[]) => {
      setDirection(1);
      setCursor(null);
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
      setSaveError(null);
      if (load.status !== "ready") return;
      saveAnswer(load.respondentId, questionId, value).catch(() => {
        setSaveError("Your last answer didn't save. Check your connection — it will retry when you continue.");
      });
    },
    [load],
  );

  const back = useCallback((fromIndex: number) => {
    setDirection(-1);
    setCursor(fromIndex - 1);
  }, []);

  const state = resolve(study, answers);
  const total = study.screening.length;

  // Stepping back shows an already-answered question, pre-filled.
  const viewing =
    cursor !== null
      ? { status: "in_progress" as const, question: study.screening[cursor], index: cursor }
      : state;

  const current = viewing.status === "in_progress" ? viewing.index : total - 1;
  const stage =
    load.status !== "ready"
      ? "Screening"
      : viewing.status === "in_progress"
        ? `Screening · ${viewing.index + 1} of ${total}`
        : "Screening · Complete";

  return (
    <StudyShell stage={stage} steps={total} current={load.status === "ready" ? current : 0}>
      {load.status === "failed" && (
        <div className="flex flex-1 items-center">
          <Notice
            title="Couldn't start the survey"
            body="The server didn't respond. Reload the page to try again — nothing has been lost."
          />
        </div>
      )}

      {load.status === "ready" && (
        <AnimatePresence custom={direction} mode="wait" initial={false}>
          {viewing.status === "in_progress" ? (
            <QuestionScreen
              key={viewing.question.id}
              question={viewing.question}
              index={viewing.index}
              value={answers[viewing.question.id]}
              direction={direction}
              notice={saveError}
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
      )}
    </StudyShell>
  );
}
