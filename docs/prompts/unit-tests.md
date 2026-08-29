# Prompt: unit tests for Soundings

Use this prompt to add or extend unit tests. Follow `CLAUDE.md` (STE comments, complexity gate, vault sync).

## Goal

Add a Vitest suite that proves the behaviour the walkthrough will defend: segmentation, resumption payloads, completion gating, request validation, client identity, and keyboard control. Tests must run without a database, without ElevenLabs, and without a browser session.

## Tooling

- Vitest with two environments: `node` (default) and `jsdom` (files under `src/lib/client` and `src/components`).
- `@testing-library/react` for hooks and components. No snapshot tests.
- Path alias `@/` resolves to `src/`.
- Scripts: `npm test` runs once, `npm run test:watch` watches.
- Test files sit next to the code: `foo.test.ts` beside `foo.ts`.

## What to test, in priority order

1. **`src/lib/survey/engine.ts`** — `resolve` and `judge`.
   - First unanswered question is the current screen, in order.
   - `terminate` on age (under 18) and on owns_car (no) ends the survey at that question; later answers are ignored.
   - Q4 precedence: `["bmw"]` → bmw_customer; `["mercedes"]` and `["audi"]` → potential; `["bmw","toyota"]` → bmw_customer (qualify beats terminate); `["bmw","audi"]` → bmw_customer (precedence order); `["audi","mercedes"]` → potential; `["toyota"]` and `["other"]` → screened_out at brands.
   - All four answered with no qualify effect is screened_out at the last question.
   - `judge` on a single-select with no effect returns `continue`.
2. **`src/lib/interview/session.ts`** — `guideFor`, `requiredIds`, `isComplete`, `buildDynamicVariables`.
   - Segment guides: bmw_customer and potential get different q7–q11 text; both get q1–q6 and q12; 12 items each.
   - `requiredIds` excludes q1 and has 11 ids.
   - `INTERVIEW_SHORT_MODE=1` limits the guide to q1, q2, q3, q12 and `requiredIds` to q2, q3, q12. Use `vi.stubEnv`.
   - `isComplete` is true only when every required id is present; extra ids do not matter.
   - `buildDynamicVariables` with no progress: `is_resume` false, `opening_line` equals q1 text, `answered_question_ids` "none", `remaining_count` 11, `prior_context` "(none)", `question_guide` has one `[id] text` line per required question and no q1.
   - With progress q2, q3: `is_resume` true, `last_topic` is q3's topic, `opening_line` starts with "Welcome back" and names the topic, `remaining_count` 9, `prior_context` has one "- topic: summary" line per entry, a null summary shows "(answered)".
   - Progress ids that are not in the guide are ignored in `prior_context`.
3. **`src/lib/interview/agent-config.ts`** — `TOOL_CONFIGS` and `buildAgentConfig`.
   - Tool names match `CLIENT_TOOLS`. The `question_id` enum is exactly the set of required ids across both segments (q2–q12, no duplicates). Both tools have `expectsResponse: false`.
   - `buildAgentConfig` sets `firstMessage` to `{{opening_line}}`, passes `toolIds` through, sets `maxDurationSeconds` 1800, and every name in `DYNAMIC_VARIABLES` has a placeholder.
4. **`src/lib/validate.ts`** — `isUuid` accepts a v4 UUID, rejects non-strings, empty strings, and near-misses.
5. **Route handlers** under `src/app/api/respondents` with `@/lib/survey/persist` and `@/lib/interview/persist` mocked (`vi.mock`). Do not mock `@/lib/interview/session` or `@/config/study`.
   - `GET [id]`: 400 on a bad id, 404 when `loadRespondent` returns null, 200 with the state.
   - `PUT answers`: 400 on unknown question, wrong type (array for single, string for multi), empty array, unknown option id; 404 when `saveAnswer` returns null; 200 passes `(id, questionId, answer)` through.
   - `POST interview/start`: 409 when not qualified, 409 when completed, 200 returns the session from `startInterviewSession`.
   - `POST interview/progress`: 400 for a question outside the segment (q7 is valid for both, but a made-up id is not; also q1), summary is truncated to 500 characters, null when absent.
   - `POST interview/end`: 400 on bad sessionId or reason, passes `conversationId` null when absent, 200 returns `{complete, progress}`.
   - Build requests with `new Request(url, {method, body})` and pass `{ params: Promise.resolve({ id }) }` as the context.
6. **`src/lib/client/respondent.ts`** (jsdom) — `loadOrCreateRespondent` with `fetch` mocked.
   - `?new=1` ignores stored and URL ids, creates, and rewrites the URL to `?rid=<id>` without `new`.
   - `?rid=` wins over localStorage.
   - A stored id is used and the URL gains `?rid=`.
   - A 404 on the stored id falls through to create; a 500 throws.
7. **`src/components/survey/useQuestionKeys.ts`** (jsdom) — with `renderHook`.
   - Digit within range calls `onPick(index)`; digit out of range does nothing.
   - Enter with no focused option calls `onAdvance`; Enter on a focused option does not.
   - Arrow keys move focus with wrap-around; from no focus, Down goes to the first and Up to the last.
   - Ctrl/Meta/Alt modified keys and keys from an input are ignored.
   - `enabled: false` registers no listener.
   - Export `nextFocusIndex` and `isReserved` for direct tests if it keeps the hook test simpler.

## Out of scope

`src/lib/survey/persist.ts`, `src/lib/interview/persist.ts`, `src/db/*`, `scripts/setup-agent.ts`, `useAudioLevels`, `InterviewFlow` (needs the ElevenLabs SDK), Motion transitions, and visual output. These are covered by the manual test checklist.

## Rules

- Each test name states the behaviour in plain words.
- One assertion group per behaviour. No test depends on another.
- Reset env stubs and mocks in `afterEach`.
- Keep the complexity gate green: `npm run lint` and `npm run typecheck` must pass with the tests included.
- When a test finds a real bug, fix the code, record the decision in the vault project log, and keep the test.
