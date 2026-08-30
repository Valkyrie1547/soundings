import type { InterviewQuestion } from "@/config/study";
import type { TranscriptTurn } from "@/db/schema";

/** One missing question that the transcript shows as asked and answered. */
export interface Candidate {
  questionId: string;
  /** The first 200 characters of the joined answer. */
  summary: string;
  evidence: { agentTurn: TranscriptTurn; userTurns: TranscriptTurn[] };
}

const SUMMARY_LENGTH = 200;
const MIN_ANSWER_WORDS = 4;
const MIN_OVERLAP = 0.6;
const SKIP_PHRASE = /^(next|skip|pass|no comment)/i;
const STAYS_OPEN = /(come back to|return to) (that|this|it)|leave (that|this|it) (open|for now)|skip (that|this|it)/i;

/** Words that carry no topic. They do not count toward the overlap. */
const STOP_WORDS = new Set([
  "a", "an", "the", "to", "of", "in", "on", "for", "with", "and", "or", "you", "your", "do", "did",
  "is", "are", "have", "has", "had", "what", "which", "how", "that", "this", "it", "be", "been",
  "would", "could", "any", "about", "there", "were", "was", "ever", "if", "at", "by", "as", "so",
  "youd", "like", "were", "me", "my", "i", "we",
]);

/** Lower-case, no punctuation, single spaces. The same for a question and a turn. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function contentWords(text: string): string[] {
  return [...new Set(normalise(text).split(" ").filter((w) => w && !STOP_WORDS.has(w)))];
}

/** True when the agent turn asks this question. The anchor decides when the question has one. */
export function matchesQuestion(question: InterviewQuestion, message: string): boolean {
  const turn = normalise(message);
  if (question.anchor) return turn.includes(normalise(question.anchor));
  const words = contentWords(question.text);
  if (words.length === 0) return false;
  const turnWords = new Set(turn.split(" "));
  const hits = words.filter((w) => turnWords.has(w)).length;
  return hits / words.length >= MIN_OVERLAP;
}

function matchesAnyOther(guide: InterviewQuestion[], questionId: string, message: string): boolean {
  return guide.some((q) => q.id !== questionId && matchesQuestion(q, message));
}

/**
 * The user turns after the agent turn at `start`, up to the next agent turn
 * that asks another guide question. An agent turn that keeps the question
 * open ends the answer with no result.
 */
function collectAnswer(
  guide: InterviewQuestion[],
  questionId: string,
  turns: TranscriptTurn[],
  start: number,
): TranscriptTurn[] | null {
  const userTurns: TranscriptTurn[] = [];
  for (const turn of turns.slice(start + 1)) {
    if (turn.role === "user") {
      userTurns.push(turn);
      continue;
    }
    if (STAYS_OPEN.test(turn.message)) return null;
    if (matchesAnyOther(guide, questionId, turn.message)) break;
  }
  return userTurns;
}

function isSubstantive(answer: string): boolean {
  const words = answer.split(/\s+/).filter(Boolean);
  return words.length >= MIN_ANSWER_WORDS && !SKIP_PHRASE.test(answer);
}

/** A candidate when the turn at `index` asks the question and gets a substantive answer. */
function candidateAt(
  guide: InterviewQuestion[],
  question: InterviewQuestion,
  turns: TranscriptTurn[],
  index: number,
): Candidate | null {
  const turn = turns[index];
  if (turn.role !== "agent" || !matchesQuestion(question, turn.message)) return null;
  const userTurns = collectAnswer(guide, question.id, turns, index);
  if (!userTurns) return null;
  const answer = userTurns.map((t) => t.message.trim()).join(" ");
  if (!isSubstantive(answer)) return null;
  return { questionId: question.id, summary: answer.slice(0, SUMMARY_LENGTH), evidence: { agentTurn: turn, userTurns } };
}

/** The candidate for one question, from the first asking that got a substantive answer. */
function findCandidate(guide: InterviewQuestion[], question: InterviewQuestion, turns: TranscriptTurn[]): Candidate | null {
  for (let index = 0; index < turns.length; index += 1) {
    const candidate = candidateAt(guide, question, turns, index);
    if (candidate) return candidate;
  }
  return null;
}

/**
 * Finds missing questions that the transcript shows as asked and answered.
 * Pure and deterministic. It is a second opinion after the tool call, never
 * the first. Only required guide questions in `missingIds` can match.
 */
export function findUnmarkedAnswers(
  guide: InterviewQuestion[],
  missingIds: string[],
  turns: TranscriptTurn[],
): Candidate[] {
  const missing = new Set(missingIds);
  return guide
    .filter((q) => q.required && missing.has(q.id))
    .map((q) => findCandidate(guide, q, turns))
    .filter((c): c is Candidate => c !== null);
}
