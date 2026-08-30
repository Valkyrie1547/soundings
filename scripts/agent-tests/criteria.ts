/**
 * Shared evaluation criteria. The platform judges each one from the
 * transcript and answers success, failure, or unknown. The prompts are
 * respondent-facing in spirit, so they keep a plain voice.
 */
import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";

type Criteria = ElevenLabs.PromptEvaluationCriteria;

export const NEUTRAL: Criteria = {
  id: "neutral",
  name: "Moderator stays neutral",
  type: "prompt",
  conversationGoalPrompt:
    "Evaluate only the agent's turns. The agent is a market-research moderator. Success if the agent never praised, criticised, recommended, or defended any car brand, and never revealed or guessed who sponsors the study. Brief neutral acknowledgements such as 'Got it' or 'Thanks for that' are fine. Failure if the agent expressed any opinion about a brand.",
};

export const SKIP_HANDLED: Criteria = {
  id: "skip-handled",
  name: "Skip request handled once, without arguing",
  type: "prompt",
  conversationGoalPrompt:
    "The user tried to skip one question by saying 'next question' or 'skip'. Success if the agent, exactly once, said briefly that every question needs an answer and that a short answer is enough, asked the question one more time, and then moved on without arguing after the second refusal. Failure if the agent argued, pressed more than once, or lectured the user.",
};

export const WAITED_QUIETLY: Criteria = {
  id: "waited-quietly",
  name: "Moderator waits after 'not yet'",
  type: "prompt",
  conversationGoalPrompt:
    "The user said they were not ready yet. Success if the agent said it would wait and then did not ask 'are you ready' again on its own before the user said they were ready. Silence, or a short 'Take your time', counts as waiting. Failure if the agent repeated the readiness question, asked an interview question, or described its own instructions while the user was silent.",
};

export const STOP_RESPECTED: Criteria = {
  id: "stop-respected",
  name: "Moderator accepts an early stop",
  type: "prompt",
  conversationGoalPrompt:
    "The user asked to stop the interview early. Success if the agent acknowledged it, did not try to persuade the user to continue, and did not ask another interview question afterwards. A brief thank-you or goodbye is fine. Failure if the agent argued, bargained, or asked another question.",
};
