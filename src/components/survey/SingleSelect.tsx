"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SingleSelectQuestion } from "@/config/study";
import { durations } from "@/lib/motion";
import { OptionRow } from "@/components/ui/OptionRow";
import { useQuestionKeys } from "./useQuestionKeys";

interface SingleSelectProps {
  question: SingleSelectQuestion;
  /** Pre-populated on resume or when stepping back. */
  value?: string;
  onAnswer: (optionId: string) => void;
}

/**
 * Pick one, and the screen advances on its own after a short confirm beat —
 * long enough to see the choice register, short enough to feel immediate.
 * A pre-filled value waits for Enter instead, so stepping back never
 * re-submits by accident.
 */
export function SingleSelect({ question, value, onAnswer }: SingleSelectProps) {
  const [chosen, setChosen] = useState<string | undefined>(value);
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const choose = useCallback(
    (index: number) => {
      if (confirming) return;
      const option = question.options[index];
      if (!option) return;
      setChosen(option.id);
      setConfirming(true);
      timer.current = window.setTimeout(() => onAnswer(option.id), durations.confirm * 1000);
    },
    [confirming, question.options, onAnswer],
  );

  const advance = useCallback(() => {
    if (chosen && !confirming) onAnswer(chosen);
  }, [chosen, confirming, onAnswer]);

  const { register } = useQuestionKeys({
    count: question.options.length,
    enabled: true,
    onPick: choose,
    onAdvance: advance,
  });

  return (
    <div role="radiogroup" aria-labelledby={`q-${question.id}`} className="flex flex-col gap-2">
      {question.options.map((option, i) => (
        <OptionRow
          key={option.id}
          ref={register(i)}
          hotkey={i + 1}
          label={option.label}
          selected={chosen === option.id}
          confirming={confirming && chosen === option.id}
          onSelect={() => choose(i)}
        />
      ))}
    </div>
  );
}
