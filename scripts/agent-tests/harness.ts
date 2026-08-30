/**
 * Runs one scenario against the live agent with the ElevenLabs simulation
 * API and gives the scenario a view over the transcript.
 *
 * The pure parts (`TranscriptView`, `viewOf`) have unit tests next to this
 * file. `simulate` talks to the platform and costs credit. Only `run.ts`
 * calls it.
 */
import type { ElevenLabs, ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { CLIENT_TOOLS } from "../../src/lib/interview/agent-config";
import type { Outcome } from "../../src/config/study";
import { buildDynamicVariables, type ProgressEntry } from "../../src/lib/interview/session";

export type Turn = ElevenLabs.ConversationHistoryTranscriptResponseModel;
export type Analysis = ElevenLabs.ConversationHistoryAnalysisCommonModel;
export type CriterionResult = ElevenLabs.EvaluationSuccessResult;

export interface ToolCall {
  params: Record<string, unknown>;
  turnIndex: number;
}

/** Scenarios 1, 4, 5, 7 must pass every time. Scenarios 2, 3, 6 depend on LLM judgement, so 80% is a pass. */
export type PassRate = 1 | 0.8;

export interface Scenario {
  name: string;
  segment: Outcome;
  /** What the database would hold. It feeds `buildDynamicVariables`. */
  progress: ProgressEntry[];
  /** 1 is the first session. 2 or more is a resume. */
  attemptNo: number;
  /** The simulated respondent's system prompt. */
  persona: string;
  /** The simulated user speaks first only when the scenario needs it. */
  firstMessage?: string;
  newTurnsLimit: number;
  criteria: ElevenLabs.PromptEvaluationCriteria[];
  passRate: PassRate;
  /** Throws on failure. */
  assert(t: TranscriptView): void;
}

export interface ScenarioResult {
  name: string;
  ok: boolean;
  error?: string;
  turns: number;
  seconds: number;
  transcript: Turn[];
  analysis: Analysis;
}

/** Parses a tool call's parameters. The platform gives them as a JSON string. */
function parseParams(call: ElevenLabs.ConversationHistoryTranscriptToolCallCommonModelOutput): Record<string, unknown> {
  try {
    return JSON.parse(call.paramsAsJson || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Assertion helpers over one simulated transcript. */
export class TranscriptView {
  constructor(
    readonly turns: Turn[],
    readonly analysis: Analysis,
  ) {}

  /** Every call of one tool, in transcript order. */
  toolCalls(name: string): ToolCall[] {
    const out: ToolCall[] = [];
    this.turns.forEach((turn, turnIndex) => {
      for (const call of turn.toolCalls ?? []) {
        if (call.toolName === name) out.push({ params: parseParams(call), turnIndex });
      }
    });
    return out;
  }

  /** The `question_id` values passed to `mark_question_answered`, in order. */
  markedIds(): string[] {
    return this.toolCalls(CLIENT_TOOLS.markAnswered).map((c) => String(c.params.question_id ?? ""));
  }

  /** The turn index of the first mark for one id, or -1. */
  markTurn(questionId: string): number {
    const call = this.toolCalls(CLIENT_TOOLS.markAnswered).find((c) => c.params.question_id === questionId);
    return call ? call.turnIndex : -1;
  }

  /** The indexes of the agent turns whose message matches. */
  agentTurns(pattern: RegExp): number[] {
    const out: number[] = [];
    this.turns.forEach((turn, i) => {
      if (turn.role === "agent" && pattern.test(turn.message ?? "")) out.push(i);
    });
    return out;
  }

  agentSaid(pattern: RegExp): boolean {
    return this.agentTurns(pattern).length > 0;
  }

  agentNeverSaid(pattern: RegExp): boolean {
    return !this.agentSaid(pattern);
  }

  /** The index of the first user turn whose message matches, or -1. */
  userTurn(pattern: RegExp): number {
    return this.turns.findIndex((turn) => turn.role === "user" && pattern.test(turn.message ?? ""));
  }

  firstAgentTurn(): string {
    return this.turns.find((turn) => turn.role === "agent")?.message ?? "";
  }

  /** The platform fills the map or the list. Both are read. */
  private criterionRecord(id: string): ElevenLabs.ConversationHistoryEvaluationCriteriaResultCommonModel | undefined {
    const byId = this.analysis.evaluationCriteriaResults?.[id];
    return byId ?? this.analysis.evaluationCriteriaResultsList?.find((r) => r.criteriaId === id);
  }

  /** The result of one evaluation criterion. A missing criterion reads as "unknown". */
  criterion(id: string): CriterionResult {
    return this.criterionRecord(id)?.result ?? "unknown";
  }

  /** The rationale the platform gave for one criterion. For failure messages. */
  rationale(id: string): string {
    return this.criterionRecord(id)?.rationale ?? "";
  }
}

export function viewOf(turns: Turn[], analysis: Analysis): TranscriptView {
  return new TranscriptView(turns, analysis);
}

/** Throws with a message when the condition is false. */
export function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/** Throws unless the criterion passed. The rationale goes in the message. */
export function checkCriterion(t: TranscriptView, id: string): void {
  const result = t.criterion(id);
  check(result === "success", `criterion ${id}: ${result}. ${t.rationale(id)}`.trim());
}

/** Builds the request body for one scenario. Pure, so a test can inspect it. */
export function requestFor(
  scenario: Scenario,
): ElevenLabs.conversationalAi.BodySimulatesAConversationV1ConvaiAgentsAgentIdSimulateConversationPost {
  const dynamicVariables = buildDynamicVariables("simulated", scenario.segment, scenario.progress, scenario.attemptNo);
  return {
    simulationSpecification: {
      // The SDK sends an explicit `undefined` as `null`, and the API rejects it. Set the key only when there is a value.
      simulatedUserConfig: {
        ...(scenario.firstMessage ? { firstMessage: scenario.firstMessage } : {}),
        language: "en",
        prompt: { prompt: scenario.persona },
      },
      // Both client tools are mocked, so the simulation does not wait for a browser.
      toolMockConfig: {
        [CLIENT_TOOLS.markAnswered]: { defaultReturnValue: "recorded" },
        [CLIENT_TOOLS.finish]: { defaultReturnValue: "ok" },
      },
      dynamicVariables,
    },
    extraEvaluationCriteria: scenario.criteria,
    newTurnsLimit: scenario.newTurnsLimit,
  };
}

/** Runs one scenario. Assertion errors become a failed result. Transport errors are thrown. */
export async function simulate(client: ElevenLabsClient, agentId: string, scenario: Scenario): Promise<ScenarioResult> {
  const started = Date.now();
  const result = await client.conversationalAi.agents.simulateConversation(agentId, requestFor(scenario));
  const seconds = Math.round((Date.now() - started) / 1000);
  const transcript = result.simulatedConversation;
  const view = viewOf(transcript, result.analysis);
  const base = { name: scenario.name, turns: transcript.length, seconds, transcript, analysis: result.analysis };
  try {
    scenario.assert(view);
    return { ...base, ok: true };
  } catch (err) {
    return { ...base, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
