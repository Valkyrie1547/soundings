import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { agentId, elevenlabs } from "@/lib/elevenlabs";
import { CLIENT_TOOLS } from "@/lib/interview/agent-config";
import { buildDynamicVariables } from "@/lib/interview/session";
import { requiredIds, type Outcome, type StudyConfig } from "@/lib/study";

/**
 * One happy-path simulation of a study segment against the live agent.
 * The admin runs it before sharing a study, so the first person to hear a
 * new guide is not a real respondent. It costs platform credit, so the
 * route rate-limits it.
 */

export interface SimulationOutcome {
  pass: boolean;
  markedIds: string[];
  expectedIds: string[];
  finishCalls: number;
  turns: { role: string; message: string }[];
}

const PERSONA =
  "You are a cooperative respondent in a voice market-research interview. Answer every question the moderator asks in one or two natural sentences, as a real person would. When the moderator asks if you are ready to begin, say \"Yes, I'm ready.\" Do not ask the moderator any questions. When the moderator says the interview is complete or says goodbye, reply \"Thanks, bye.\" and nothing else.";

/** How many new turns the simulation may take: two per required question, plus room for the opening and closing. */
export function turnBudget(study: StudyConfig, segment: Outcome): number {
  return requiredIds(study, segment).length * 2 + 8;
}

function toolCallIds(turns: ElevenLabs.ConversationHistoryTranscriptResponseModel[], name: string): string[] {
  const out: string[] = [];
  for (const turn of turns) {
    for (const call of turn.toolCalls ?? []) {
      if (call.toolName !== name) continue;
      try {
        out.push(String((JSON.parse(call.paramsAsJson || "{}") as { question_id?: unknown }).question_id ?? ""));
      } catch {
        out.push("");
      }
    }
  }
  return out;
}

export async function simulateHappyPath(study: StudyConfig, segment: Outcome): Promise<SimulationOutcome> {
  const result = await elevenlabs().conversationalAi.agents.simulateConversation(agentId(), {
    simulationSpecification: {
      simulatedUserConfig: { language: "en", prompt: { prompt: PERSONA } },
      toolMockConfig: {
        [CLIENT_TOOLS.markAnswered]: { defaultReturnValue: "recorded" },
        [CLIENT_TOOLS.finish]: { defaultReturnValue: "ok" },
      },
      dynamicVariables: buildDynamicVariables(study, "admin-simulation", segment, []),
    },
    newTurnsLimit: turnBudget(study, segment),
  });

  const turns = result.simulatedConversation;
  const markedIds = toolCallIds(turns, CLIENT_TOOLS.markAnswered);
  const expectedIds = requiredIds(study, segment);
  const finishCalls = turns.reduce(
    (n, t) => n + (t.toolCalls ?? []).filter((c) => c.toolName === CLIENT_TOOLS.finish).length,
    0,
  );
  return {
    pass: markedIds.join(",") === expectedIds.join(",") && finishCalls === 1,
    markedIds,
    expectedIds,
    finishCalls,
    turns: turns.map((t) => ({ role: t.role, message: t.message ?? "" })),
  };
}
