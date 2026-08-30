# Prompt: ElevenLabs simulated-conversation tests for the interview agent

Use this prompt to build an automated test suite for the moderator agent. Follow `CLAUDE.md` (STE comments, complexity gate, vault sync).

## Goal

Every prompt bug found by ear during manual runs becomes a repeatable test. The suite runs the real agent (`ELEVENLABS_AGENT_ID`) against an AI-simulated respondent, then asserts on tool calls and on evaluation criteria. It runs from the command line and, later, in CI before `npm run agent:setup` is allowed to update the agent.

## API to use

`@elevenlabs/elevenlabs-js` (already installed), server side:

```ts
const result = await client.conversationalAi.agents.simulateConversation(agentId, {
  simulationSpecification: {
    simulatedUserConfig: { prompt: { prompt: "<persona>" }, firstMessage?: string, language: "en" },
    toolMockConfig: { mark_question_answered: {...}, finish_interview: {...} },   // mocks for client tools
    dynamicVariables: buildDynamicVariables(...),                                  // reuse the real builder
    partialConversationHistory?: [...],                                            // start mid-interview
  },
  extraEvaluationCriteria: [{ id, name, conversationGoalPrompt }],
  newTurnsLimit: 40,
});
// result.simulatedConversation: transcript turns, each with role, message, and tool_calls / tool_results
// result.analysis: evaluation results keyed by criterion id, with "success" | "failure" | "unknown"
```

Check the exact field names in `node_modules/@elevenlabs/elevenlabs-js/api/types/` before writing code (`ConversationSimulationSpecification`, `ToolMockConfig`, `PromptEvaluationCriteria`, `ConversationHistoryTranscriptResponseModel`, `ConversationHistoryAnalysisCommonModel`). The SDK also exposes `agents.simulateConversationStream` and a `tests` resource (`conversationalAi.tests.create/list/get`) for tests stored on the platform; prefer the one-shot `simulateConversation` so the suite lives in the repo.

## Layout

```
scripts/agent-tests/
  run.ts                 entry: node --env-file=.env.local --import tsx scripts/agent-tests/run.ts [--only <name>] [--json]
  harness.ts             simulate(scenario) -> ScenarioResult; assertion helpers over the transcript
  scenarios/
    happy-path.ts
    skip-request.ts
    not-ready-then-silent.ts
    resume-mid-interview.ts
    resume-before-first-mark.ts
    stop-early.ts
    segment-routing.ts
  criteria.ts            shared PromptEvaluationCriteria definitions
```

Add `"agent:test": "node --env-file=.env.local --import tsx scripts/agent-tests/run.ts"` to `package.json`. Do not put these under Vitest: they cost platform credit and take minutes. Keep them out of `npm test`.

## Scenario contract

```ts
interface Scenario {
  name: string;
  segment: Outcome;
  progress: ProgressEntry[];          // what the DB would hold; feeds buildDynamicVariables
  attemptNo: number;                  // 1 = first session, 2+ = resume
  persona: string;                    // the simulated respondent's system prompt
  firstMessage?: string;              // simulated user speaks first only when the scenario needs it
  newTurnsLimit: number;
  criteria: PromptEvaluationCriteria[];
  assert(t: TranscriptView): void;    // throws on failure; uses helpers below
}
```

Harness helpers over the returned transcript:

- `toolCalls(name)` → list of `{ params, turnIndex }`
- `markedIds()` → ordered `question_id` values passed to `mark_question_answered`
- `agentSaid(regex)` / `agentNeverSaid(regex)`
- `firstAgentTurn()`
- `criterion(id)` → `"success" | "failure" | "unknown"`

## Scenarios and what each must prove

1. **happy-path** (bmw_customer, attemptNo 1, no progress). Persona: cooperative, answers every question in one or two sentences, says "yes" to the readiness check.
   - `markedIds()` equals `requiredIds("bmw_customer")` in order, no duplicates.
   - `finish_interview` is called exactly once, after the last mark.
   - Agent never says a bracketed id (`/\[q\d+\]/`).
   - Criterion `neutral`: the moderator never praised or criticised a brand.
2. **skip-request**. Persona: answers q2 and q3, then replies "next question" to q4, and again "skip" when re-asked; answers everything after.
   - `markedIds()` does not contain `q4` before the closing; q4 is asked again before the closing remarks (agent turn containing the q4 wording occurs after the q12 mark).
   - Criterion `skip-handled`: the moderator said once that a short answer is enough and did not argue.
3. **not-ready-then-silent**. Persona: says "no, not yet" to the readiness check, then replies with an empty message twice, then "ok, ready".
   - Agent never says `/prompt|instruct|told to|I was asked/i`.
   - No question is marked before the persona says ready.
   - Criterion `waited-quietly`: after "not yet", the moderator said it would wait and did not repeat the readiness question on its own.
4. **resume-mid-interview** (attemptNo 2, progress q2–q5 with summaries).
   - `firstAgentTurn()` starts with "Welcome back" and contains the q5 topic (the dynamic variables carry it; assert the agent did not replace it).
   - First question asked is q6; q2–q5 never appear in agent turns.
   - No intro sentence (`/10-15 questions|10 to 15/`).
5. **resume-before-first-mark** (attemptNo 2, no progress).
   - Opening is the "We hadn't started the questions yet" line; no re-introduction; q2 asked next.
6. **stop-early**. Persona: after q3 says "I need to stop now."
   - `finish_interview` called; no further questions asked; agent did not argue (criterion).
7. **segment-routing** (potential_bmw_customer, happy path).
   - q7 asked is the Potential wording ("considered purchasing a BMW"); the BMW-customer q7 wording never appears.
   - `markedIds()` equals the Potential required ids.

## Tool mocks

Mock both client tools so the simulation does not block: `mark_question_answered` returns `"recorded"`, `finish_interview` returns `"ok"`. The assertions read the calls from the transcript, not from the mock.

## Output

`run.ts` prints one line per scenario (`PASS happy-path 38 turns 41s` / `FAIL skip-request: q4 marked at turn 12`), then a summary, exit code 1 on any failure. `--json` writes `scripts/agent-tests/last-run.json` (gitignored) with full transcripts for debugging. Mask nothing in transcripts, but never print the API key.

## Guardrails

- Read `ELEVENLABS_AGENT_ID` from env; refuse to run without it.
- Each run costs credit. Print the estimated turn count before starting and require `--yes` or `CI=1` to run more than three scenarios.
- Simulations are non-deterministic. Allow `--repeat N` and report a pass rate; treat < 100% on scenarios 1, 4, 5 as a failure, and ≥ 80% on 2, 3, 6 as a pass (they depend on LLM judgement).
- Do not change the agent prompt from within the test harness. When a scenario fails, fix `agent-config.ts`, run `npm run agent:setup`, re-run, and record the decision in the vault project log.

## Definition of done

- `npm run agent:test --only happy-path` passes three times in a row.
- All seven scenarios pass at the rates above.
- README scripts table and `system architecture.md` conventions section mention `agent:test`.
- Project log entry: what the suite covers, what it costs per run, and why platform-stored tests were not used.
