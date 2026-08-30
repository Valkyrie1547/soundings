"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { copyFor, type StudyConfig } from "@/lib/study";
import { resolve, type Answers } from "@/lib/survey/engine";
import type { Direction } from "@/lib/motion";
import { loadOrCreateRespondent, saveAnswer } from "@/lib/client/respondent";
import { pathsFor } from "@/lib/client/paths";
import { StudyShell } from "@/components/layout/StudyShell";
import { Notice } from "@/components/ui/Notice";
import { OutcomeScreen } from "./OutcomeScreen";
import { QuestionScreen } from "./QuestionScreen";

type Load =
  | { status: "loading" }
  | { status: "ready"; respondentId: string }
  | { status: "failed" };

/**
 * Runs the screening survey from stored answers. On load, the answers from
 * the server decide the screen. A first visit, a refresh in the middle of
 * the survey, and a return after some days use the same code path. The
 * client saves each answer when the user gives it. The UI advances before
 * the save completes. When a save fails, the UI shows a notice and keeps
 * the local answer.
 */
export function SurveyFlow({ study }: { study: StudyConfig }) {
  const router = useRouter();
  const paths = pathsFor(study.id);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [answers, setAnswers] = useState<Answers>({});
  const [direction, setDirection] = useState<Direction>(1);
  const [cursor, setCursor] = useState<number | null>(null); // Set after a step back.
  const [saveError, setSaveError] = useState<string | null>(null);
  // The last save. The outcome screen waits for it before it goes to the interview.
  const pendingSave = useRef<Promise<unknown> | null>(null);
  const lastAnswer = useRef<{ questionId: string; value: string | string[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadOrCreateRespondent(study.id)
      .then((state) => {
        if (cancelled) return;
        // The survey is complete. This visit goes to Part 2.
        if (state.surveyStatus === "qualified") {
          router.replace(state.interviewStatus === "completed" ? paths.transcript : paths.interview);
          return;
        }
        setAnswers(state.answers);
        setLoad({ status: "ready", respondentId: state.id });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [router, study.id, paths.interview, paths.transcript]);

  const answer = useCallback(
    (questionId: string, value: string | string[]) => {
      setDirection(1);
      setCursor(null);
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
      setSaveError(null);
      if (load.status !== "ready") return;
      lastAnswer.current = { questionId, value };
      pendingSave.current = saveAnswer(load.respondentId, questionId, value).catch(() => {
        setSaveError("Your last answer didn't save. Check your connection — it will retry when you continue.");
        throw new Error("save failed");
      });
    },
    [load],
  );

  // Go to the interview only after the server has the final answer. Try the save once more when it failed.
  const continueToInterview = useCallback(async () => {
    if (load.status !== "ready") return;
    try {
      await pendingSave.current;
    } catch {
      const last = lastAnswer.current;
      if (!last) return;
      try {
        await saveAnswer(load.respondentId, last.questionId, last.value);
        setSaveError(null);
      } catch {
        return;
      }
    }
    router.push(paths.interview);
  }, [load, router, paths.interview]);

  const back = useCallback((fromIndex: number) => {
    setDirection(-1);
    setCursor(fromIndex - 1);
  }, []);

  const state = resolve(study, answers);
  const total = study.screening.length;

  // A step back shows an answered question with its stored value.
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
    <StudyShell study={study} stage={stage} steps={total} current={load.status === "ready" ? current : 0}>
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
              copy={copyFor(study)}
              direction={direction}
              onContinue={continueToInterview}
            />
          )}
        </AnimatePresence>
      )}
    </StudyShell>
  );
}
