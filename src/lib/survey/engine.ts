import type { Option, Outcome, Question, StudyConfig } from "@/config/study";

/** Answers keyed by question id. Multi-select questions store an array. */
export type Answers = Record<string, string | string[]>;

export type SurveyState =
  | { status: "in_progress"; question: Question; index: number }
  | { status: "screened_out"; atQuestion: string }
  | { status: "qualified"; outcome: Outcome };

/**
 * Pure survey engine. Given the config and the answers so far, says where
 * the respondent is. Because it is a pure function of stored answers, the
 * same call resolves a fresh visit, a resume, and a screen-out re-entry.
 */
export function resolve(config: StudyConfig, answers: Answers): SurveyState {
  for (let index = 0; index < config.screening.length; index++) {
    const question = config.screening[index];
    const answer = answers[question.id];
    if (answer === undefined) {
      return { status: "in_progress", question, index };
    }
    const verdict = judge(question, answer, config.outcomePrecedence);
    if (verdict.kind === "terminate") {
      return { status: "screened_out", atQuestion: question.id };
    }
  }
  const outcome = finalOutcome(config, answers);
  return outcome
    ? { status: "qualified", outcome }
    : { status: "screened_out", atQuestion: config.screening.at(-1)!.id };
}

type Verdict =
  | { kind: "continue" }
  | { kind: "terminate" }
  | { kind: "qualify"; outcome: Outcome };

/** Applies one question's branching to its answer. */
export function judge(
  question: Question,
  answer: string | string[],
  precedence: Outcome[],
): Verdict {
  const chosen = selectedOptions(question, answer);
  const qualifying = chosen
    .map((o) => (o.effect?.kind === "qualify" ? o.effect.outcome : null))
    .filter((o): o is Outcome => o !== null);

  if (qualifying.length > 0) {
    const best = precedence.find((p) => qualifying.includes(p)) ?? qualifying[0];
    return { kind: "qualify", outcome: best };
  }
  if (chosen.some((o) => o.effect?.kind === "terminate")) {
    return { kind: "terminate" };
  }
  return { kind: "continue" };
}

function finalOutcome(config: StudyConfig, answers: Answers): Outcome | null {
  for (const question of config.screening) {
    const verdict = judge(question, answers[question.id], config.outcomePrecedence);
    if (verdict.kind === "qualify") return verdict.outcome;
  }
  return null;
}

function selectedOptions(question: Question, answer: string | string[]): Option[] {
  const ids = new Set(Array.isArray(answer) ? answer : [answer]);
  return question.options.filter((o) => ids.has(o.id));
}
