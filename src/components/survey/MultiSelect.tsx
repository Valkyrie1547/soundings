"use client";

import { useCallback, useState } from "react";
import type { MultiSelectQuestion } from "@/config/study";
import { Button } from "@/components/ui/Button";
import { KeyHint } from "@/components/ui/KeyHint";
import { OptionRow } from "@/components/ui/OptionRow";
import { useQuestionKeys } from "./useQuestionKeys";

interface MultiSelectProps {
  question: MultiSelectQuestion;
  /** Pre-populated on resume or when stepping back. */
  value?: string[];
  onAnswer: (optionIds: string[]) => void;
}

/**
 * Toggle any number, then continue explicitly — a multi-select can't know
 * when you're done, so it never auto-advances. Order of selection is kept,
 * which the engine ignores but the data model preserves.
 */
export function MultiSelect({ question, value, onAnswer }: MultiSelectProps) {
  const [chosen, setChosen] = useState<string[]>(value ?? []);

  const toggle = useCallback(
    (index: number) => {
      const option = question.options[index];
      if (!option) return;
      setChosen((prev) =>
        prev.includes(option.id) ? prev.filter((id) => id !== option.id) : [...prev, option.id],
      );
    },
    [question.options],
  );

  const advance = useCallback(() => {
    if (chosen.length > 0) onAnswer(chosen);
  }, [chosen, onAnswer]);

  const { register } = useQuestionKeys({
    count: question.options.length,
    enabled: true,
    onPick: toggle,
    onAdvance: advance,
  });

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-labelledby={`q-${question.id}`} className="flex flex-col gap-2">
        {question.options.map((option, i) => (
          <OptionRow
            key={option.id}
            ref={register(i)}
            multi
            hotkey={i + 1}
            label={option.label}
            selected={chosen.includes(option.id)}
            onSelect={() => toggle(i)}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={advance} disabled={chosen.length === 0}>
          Continue
        </Button>
        <span className="hidden items-center gap-1.5 font-mono text-[12px] text-muted sm:flex">
          or press <KeyHint>↵</KeyHint>
        </span>
      </div>
    </div>
  );
}
