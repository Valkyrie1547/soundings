"use client";

import type { Question } from "@/config/study";
import { MultiSelect } from "./MultiSelect";
import { SingleSelect } from "./SingleSelect";

interface QuestionRendererProps {
  question: Question;
  value?: string | string[];
  onAnswer: (value: string | string[]) => void;
}

/** Picks the input for a question's type. The screen around it is shared. */
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
