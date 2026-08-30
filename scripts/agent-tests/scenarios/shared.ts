/**
 * Text that more than one scenario uses: the cooperative respondent persona
 * and a key phrase for each guide question of the vehicle study. A phrase
 * is a short, distinctive part of the scripted wording, so a small change
 * in punctuation by the agent does not break an assertion.
 */
import type { Outcome } from "../../../src/lib/study";

/** The study every vehicle scenario runs against. */
export const VEHICLE_STUDY = "vehicle-ownership";

/** The cooperative respondent. Each scenario adds its own twist after this text. */
export function cooperative(vehicle: string, subject = "car ownership"): string {
  return `You are a respondent in a voice market-research interview about ${subject}. You own ${vehicle}. Answer every question the moderator asks in one or two natural sentences, as a real person would. When the moderator asks if you are ready to begin, say "Yes, I'm ready." Do not ask the moderator any questions. Do not offer extra topics. When the moderator says the interview is complete or says goodbye, reply "Thanks, bye." and nothing else.`;
}

export const BMW_OWNER = "a BMW 3 Series that you bought new about three years ago";
export const AUDI_OWNER = "an Audi A4 that you bought new about two years ago";

const SHARED: Record<string, RegExp> = {
  q2: /how long have you owned/i,
  q3: /main factors/i,
  q4: /scale of (1|one) to (10|ten)/i,
  q5: /features or aspects/i,
  q6: /issues or concerns/i,
  q12: /anything else/i,
};

const BY_SEGMENT: Record<Outcome, Record<string, RegExp>> = {
  bmw_customer: {
    q7: /choose BMW over/i,
    q8: /customer service and dealership/i,
    q9: /which BMW model/i,
    q10: /purchase another BMW/i,
    q11: /could BMW improve/i,
  },
  potential_bmw_customer: {
    q7: /considered purchasing a BMW/i,
    q8: /perceptions or impressions/i,
    q9: /switch to BMW/i,
    q10: /current brand does better/i,
    q11: /recommend a luxury car brand/i,
  },
};

/** The key phrase of one question for one segment. */
export function wording(segment: Outcome, id: string): RegExp {
  const found = SHARED[id] ?? BY_SEGMENT[segment]?.[id];
  if (!found) throw new Error(`no wording for ${id}`);
  return found;
}

/** One pattern that matches any required question of the segment. */
export function anyQuestion(segment: Outcome): RegExp {
  const all = [...Object.values(SHARED), ...Object.values(BY_SEGMENT[segment] ?? {})];
  return new RegExp(all.map((r) => r.source).join("|"), "i");
}

/** The agent never reads a bracketed id aloud. */
export const BRACKETED_ID = /\[q\d+\]/;

/** The first-session introduction. A resumed session must not repeat it. */
export const INTRO = /10-15 questions|10 to 15|thank you for participating/i;
