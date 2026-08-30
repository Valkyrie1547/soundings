# Prompt: transcript-scan backstop for missed `mark_question_answered` calls

Use this prompt to close the last gap in completion gating. Follow `CLAUDE.md` (STE comments, complexity gate, vault sync, tests next to code).

## Problem

Completion is decided from `interview_progress`, which the agent fills through the `mark_question_answered` client tool. The tool call is an LLM decision. If the model asks q6, hears a full answer, and forgets the call, the respondent cannot finish: `Finish interview` stays disabled and the resume opener says q6 is open. The manual runs have not shown this yet, but it is the one failure mode left that the respondent cannot recover from by themselves.

## Design

When a segment closes and the gate says "incomplete", read the segment's transcript and look for evidence that a missing question was asked and answered. If the evidence is clear, insert the progress row with a summary and a `source` of `"transcript"`. The gate then runs again.

The backstop is a **second opinion, never the first**. It runs only for ids the tool did not mark, only from the transcript of the segment that just ended, and only when the agent's wording of the question appears in an agent turn.

## Where it lives

```
src/lib/interview/backstop.ts        pure: findUnmarkedAnswers(guide, missingIds, turns) -> Candidate[]
src/lib/interview/backstop.test.ts   unit tests on fixture transcripts
src/lib/interview/persist.ts         endInterviewSession calls the backstop when !complete
src/db/schema.ts                     interview_progress.source text default 'tool'  ('tool' | 'transcript')
```

No new route. No client change except showing the tick, which already happens through `progress` in the `end` response.

## Algorithm (`findUnmarkedAnswers`)

Input: the segment guide (`guideFor(segment)`), the required ids still missing, and the transcript turns `{role, message, timeInCallSecs}` of the closed segment.

1. For each missing id, find agent turns whose message matches that question. Match is a normalised token overlap with the guide `text` (lower-case, strip punctuation, ≥ 60% of the question's content words present) or a fixed anchor phrase per question added to the config (`anchor?: string` on `InterviewQuestion`, for example q4 → "scale of 1 to 10"). Prefer the anchor when present.
2. Take the user turns that follow that agent turn, up to the next agent turn that matches any other guide question. Join them.
3. The joined answer is **substantive** when it has ≥ 4 words and is not a skip phrase (`/^(next|skip|pass|no comment)/i`, or the agent's next turn says the question stays open).
4. Return `{ questionId, summary, evidence: { agentTurn, userTurns } }` for each match. `summary` is the first 200 characters of the joined answer, in third person is not required here.

Keep this function pure and deterministic. No LLM call in v1. An LLM-judged variant (send the agent turn + user turns to a small model with the question and ask "answered? yes/no + one-sentence summary") is v2 and goes behind `BACKSTOP_LLM=1`; document it as the improvement, do not build it first.

## Persistence (`endInterviewSession`)

After the session row is stamped and `complete` is false:

1. Fetch the transcript for this segment's `conversationId` through the existing `loadTranscript` path (it stores it; reuse, do not duplicate the ElevenLabs call). If the conversation is still `in-progress`/`initiated`, skip the backstop for now; the next `start` or transcript GET will not re-run it, so also run the backstop lazily in `startInterviewSession` for any closed segment whose transcript arrived later and whose ids are still missing. Keep this second path small: one helper `applyBackstop(respondentId, segment)` used by both.
2. Call `findUnmarkedAnswers`. For each candidate, `insert ... onConflictDoNothing` into `interview_progress` with `source: "transcript"`. Never overwrite a tool-sourced row.
3. Recompute `isComplete`. Return `{ complete, progress, backstop: candidates.map(id) }` so the client can show which ticks came from the transcript.

## Schema change

`interview_progress.source text NOT NULL DEFAULT 'tool'`. `npm run db:push`. `loadProgress` returns `source` too; `RespondentState.interviewProgress` stays a string array.

## UI

In the interview checklist, a transcript-sourced tick gets a hollow diamond and the title "Confirmed from the transcript". No other change. The transcript page is unchanged.

## Tests (Vitest, next to the code)

Fixture transcripts as small arrays of turns. Cover:

- Question asked with the exact wording, answered in two user turns → one candidate with the joined summary.
- Question asked, user says "next question" → no candidate.
- Question asked, user gives a three-word answer → no candidate.
- Question never asked → no candidate, even if the user mentions the topic.
- Two missing questions, one answered → exactly one candidate with the correct id.
- Anchor phrase matches a paraphrased question; token overlap alone would not.
- Segment-specific q7 wording from the other segment does not match.
- Persistence: `endInterviewSession` with a mocked `loadTranscript` and mocked `db` inserts only for candidates and never for ids already present.

## Guardrails

- The backstop never marks q1 and never marks an id outside `requiredIds(segment)`.
- It never runs when `complete` is already true.
- It logs one line per inserted row (`backstop: q6 from transcript, respondent …`) so a demo can show it working.
- If the transcript fetch throws, return the original gate result. The backstop must not make `end` fail.

## Definition of done

- `npm test`, `npm run lint`, `npm run typecheck` green.
- Manual check: run an interview, answer q6, and prevent the tool call by having the agent prompt temporarily say "do not mark q6" (revert after). The end screen should still show 11/11 with a hollow diamond on q6.
- Project log entry: the trade-off (deterministic matcher first, LLM judge deferred; `source` column so tool and transcript ticks stay distinguishable). Architecture doc: new module, schema column, `end` response shape.
