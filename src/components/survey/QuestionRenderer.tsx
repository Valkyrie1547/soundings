"use client";

import type { Question } from "@/lib/study";
import { MultiSelect } from "./MultiSelect";
import { SingleSelect } from "./SingleSelect";

interface QuestionRendererProps {
  question: Question;
  value?: string | string[];
  onAnswer: (value: string | string[]) => void;
}

/** Selects the input for the question type. The screen around it is shared. */
export function QuestionRenderer({ question, value, onAnswer }: QuestionRendererProps) {
  switch (question.type) {
    case "single":
      return (
        <SingleSelect
          question={question}
          value={typeof value === "string" ? value : undefined}
          onAnswer={onAnswer}
        />
      );
    case "multi":
      return (
        <MultiSelect
          question={question}
          value={Array.isArray(value) ? value : undefined}
          onAnswer={onAnswer}
        />
      );
  }
}
