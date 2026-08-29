import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { study } from "@/config/study";

/**
 * The ElevenLabs agent, as code. `scripts/setup-agent.ts` pushes this to
 * the platform; nothing about the agent lives only in the dashboard.
 *
 * The prompt is deliberately generic: the question guide, the respondent's
 * segment, and any resume context arrive as dynamic variables built by our
 * server from the database at session start. That is what makes resumption
 * work without any native support — a resumed interview is just a new
 * session whose variables say "you've already covered q2–q5".
 */

export const CLIENT_TOOLS = {
  markAnswered: "mark_question_answered",
  finish: "finish_interview",
} as const;

export const DYNAMIC_VARIABLES = [
  "respondent_id",
  "segment_label",
  "question_guide",
  "answered_question_ids",
  "remaining_count",
  "is_resume",
  "last_topic",
  "prior_context",
  "opening_line",
] as const;

export type DynamicVariables = Record<(typeof DYNAMIC_VARIABLES)[number], string | number | boolean>;

const PROMPT = `You are a professional, warm market-research moderator conducting a voice interview about vehicle ownership for an independent research study. You are neutral: never praise or criticise any brand, never reveal who sponsors the study, and never speculate about why a question is asked.

## The respondent
Segment: {{segment_label}}.

## The interview guide
Ask these questions in order, one at a time, using the wording given. Do not skip, reorder, or invent questions. Do not read the bracketed ids aloud.

{{question_guide}}

## Progress
Questions already answered in a previous session (do NOT ask these again): {{answered_question_ids}}
Questions remaining: {{remaining_count}}

## How to run the interview
- Ask one question, then listen. Let the respondent finish. Brief acknowledgements ("Got it", "Thanks for that") are fine; do not editorialise.
- If an answer is thin, ask at most one short neutral follow-up ("Could you say a little more about that?"), then move on.
- IMMEDIATELY after the respondent has answered a question, call the tool \`${CLIENT_TOOLS.markAnswered}\` with that question's id and a one-sentence summary of the answer. Do this for every question, before you speak the next one. Never mark a question the respondent has not actually answered.
- The readiness check has no id to mark; if they are not ready, wait and ask again.
- After the final question has been answered and marked, thank the respondent briefly, tell them the interview is complete, and then call \`${CLIENT_TOOLS.finish}\`.
- If the respondent asks to stop early, acknowledge it and call \`${CLIENT_TOOLS.finish}\` — do not argue.

## Resuming
{{is_resume}} indicates whether this is a resumed session. If it is true: your first words are already set, so do not re-introduce yourself and do not repeat the readiness check. Use this context from the earlier session where it helps you sound continuous:
{{prior_context}}
Continue with the first question that has not been answered.

## Style
Spoken English, conversational, unhurried. Short sentences. No lists, no headings, no emoji — this is voice.`;

export function buildAgentConfig(): ElevenLabs.conversationalAi.BodyCreateAgentV1ConvaiAgentsCreatePost {
  const questionIds = [...new Set(study.interview.filter((q) => q.required).map((q) => q.id))];

  return {
    name: `${study.name} — ${study.title}`,
    tags: ["soundings"],
    conversationConfig: {
      agent: {
        language: "en",
        firstMessage: "{{opening_line}}",
        disableFirstMessageInterruptions: true,
        dynamicVariables: {
          dynamicVariablePlaceholders: {
            respondent_id: "preview",
            segment_label: "Owner of a luxury vehicle",
            question_guide: "[q2] How long have you owned your current vehicle?",
            answered_question_ids: "none",
            remaining_count: 11,
            is_resume: false,
            last_topic: "",
            prior_context: "",
            opening_line: study.interview[0].text,
          },
        },
        prompt: {
          prompt: PROMPT,
          llm: "gemini-2.5-flash",
          temperature: 0.4,
          tools: [
            {
              type: "client",
              name: CLIENT_TOOLS.markAnswered,
              description:
                "Record that the respondent has answered one interview question. Call it immediately after each answer, before asking the next question.",
              expectsResponse: false,
              parameters: {
                type: "object",
                required: ["question_id", "summary"],
                properties: {
                  question_id: {
                    type: "string",
                    enum: questionIds,
                    description: "The bracketed id of the question that was just answered, e.g. q4.",
                  },
                  summary: {
                    type: "string",
                    description: "One sentence summarising the respondent's answer, in the third person.",
                  },
                },
              },
            },
            {
              type: "client",
              name: CLIENT_TOOLS.finish,
              description:
                "End the interview. Call it after your closing remarks once every question is answered, or if the respondent asks to stop.",
              expectsResponse: false,
              parameters: { type: "object", properties: {} },
            },
          ],
        },
      },
      conversation: {
        // The brief's interview runs 10–15 minutes; the platform default (600s) would cut it off.
        maxDurationSeconds: 1800,
      },
    },
  };
}
