/**
 * Study configuration. This file is the single source of truth for one study.
 *
 * All respondent-facing content that is specific to this study is here:
 * the name, the accent color, the screening questions with their branch
 * rules, and the interview guide. To change the study, change this file.
 *
 * The configuration is sponsor-blind. No respondent-facing text names the
 * sponsor brand. Brand names only occur where the respondent reports them.
 */

export type Outcome = "bmw_customer" | "potential_bmw_customer";

export type OptionEffect =
  | { kind: "terminate" }
  | { kind: "qualify"; outcome: Outcome };

export interface Option {
  id: string;
  label: string;
  effect?: OptionEffect;
}

interface BaseQuestion {
  id: string;
  prompt: string;
  options: Option[];
}

export interface SingleSelectQuestion extends BaseQuestion {
  type: "single";
}

export interface MultiSelectQuestion extends BaseQuestion {
  type: "multi";
  /** Text for the eyebrow label, for example "Select all that apply". */
  hint?: string;
}

export type Question = SingleSelectQuestion | MultiSelectQuestion;

/** One item in the interview guide. */
export interface InterviewQuestion {
  id: string;
  /** The respondents that hear this question. */
  audience: "all" | Outcome;
  /** True when the question counts for completion. The readiness check (q1) does not count. */
  required: boolean;
  /** The words the moderator speaks, as given in the study brief. */
  text: string;
  /** A short label for the progress list and for the resume greeting. */
  topic: string;
  /**
   * A short phrase from the spoken wording. The transcript backstop matches
   * this phrase when the agent paraphrases the question. Use it only where
   * word overlap with `text` is weak.
   */
  anchor?: string;
}

export interface StudyConfig {
  /** The product name. It shows in the header. */
  name: string;
  /** The study title that respondents see. */
  title: string;
  theme: {
    accent: { light: string; dark: string };
    onAccent: { light: string; dark: string };
  };
  screening: Question[];
  /** The interview guide in order. The engine filters it by segment at runtime. */
  interview: InterviewQuestion[];
  /**
   * Precedence for a multi-select answer that has both qualify and terminate
   * options. A qualify option wins. When more than one outcome qualifies,
   * the first outcome in this list wins. Assumption: a respondent who owns a
   * BMW and a Toyota is a BMW owner.
   */
  outcomePrecedence: Outcome[];
}

export const study: StudyConfig = {
  name: "Soundings",
  title: "Vehicle ownership study",
  theme: {
    accent: { light: "#1f4e79", dark: "#c8a55b" },
    onAccent: { light: "#f8f9f9", dark: "#0e1316" },
  },
  outcomePrecedence: ["bmw_customer", "potential_bmw_customer"],
  screening: [
    {
      id: "age",
      type: "single",
      prompt: "How old are you?",
      options: [
        { id: "under_18", label: "Under 18", effect: { kind: "terminate" } },
        { id: "18_24", label: "18–24" },
        { id: "25_34", label: "25–34" },
        { id: "35_44", label: "35–44" },
        { id: "45_54", label: "45–54" },
        { id: "55_64", label: "55–64" },
        { id: "65_plus", label: "65+" },
      ],
    },
    {
      id: "income",
      type: "single",
      prompt: "What is your annual household income?",
      options: [
        { id: "under_25k", label: "Under $25,000" },
        { id: "25k_50k", label: "$25,000 – $49,999" },
        { id: "50k_75k", label: "$50,000 – $74,999" },
        { id: "75k_100k", label: "$75,000 – $99,999" },
        { id: "100k_150k", label: "$100,000 – $149,999" },
        { id: "150k_plus", label: "$150,000+" },
      ],
    },
    {
      id: "owns_car",
      type: "single",
      prompt: "Do you currently own a car?",
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No", effect: { kind: "terminate" } },
      ],
    },
    {
      id: "brands",
      type: "multi",
      prompt: "Which car brands do you currently own?",
      hint: "Select all that apply",
      options: [
        { id: "bmw", label: "BMW", effect: { kind: "qualify", outcome: "bmw_customer" } },
        { id: "mercedes", label: "Mercedes-Benz", effect: { kind: "qualify", outcome: "potential_bmw_customer" } },
        { id: "audi", label: "Audi", effect: { kind: "qualify", outcome: "potential_bmw_customer" } },
        { id: "toyota", label: "Toyota", effect: { kind: "terminate" } },
        { id: "honda", label: "Honda", effect: { kind: "terminate" } },
        { id: "ford", label: "Ford", effect: { kind: "terminate" } },
        { id: "tesla", label: "Tesla", effect: { kind: "terminate" } },
        { id: "other", label: "Other", effect: { kind: "terminate" } },
      ],
    },
  ],
  interview: [
    {
      id: "q1",
      audience: "all",
      required: false,
      topic: "getting started",
      text: "Thank you for participating in our survey. I'm going to ask you 10-15 questions about your car ownership experience. This should take about 10-15 minutes. Are you ready to begin?",
    },
    { id: "q2", audience: "all", required: true, topic: "how long you've owned your vehicle", text: "How long have you owned your current vehicle?", anchor: "how long have you owned" },
    { id: "q3", audience: "all", required: true, topic: "what influenced your purchase", text: "What were the main factors that influenced your decision to purchase this specific brand?" },
    { id: "q4", audience: "all", required: true, topic: "your satisfaction rating", text: "On a scale of 1 to 10, how satisfied are you with your current vehicle?", anchor: "scale of 1 to 10" },
    { id: "q5", audience: "all", required: true, topic: "the features you value most", text: "What features or aspects of your car do you value most?" },
    { id: "q6", audience: "all", required: true, topic: "issues or concerns with your vehicle", text: "Have you experienced any issues or concerns with your vehicle?", anchor: "any issues or concerns" },

    { id: "q7", audience: "bmw_customer", required: true, topic: "why you chose BMW over other luxury brands", text: "What made you choose BMW over other luxury brands like Mercedes or Audi?" },
    { id: "q8", audience: "bmw_customer", required: true, topic: "BMW's customer service and dealership experience", text: "How would you rate BMW's customer service and dealership experience?" },
    { id: "q9", audience: "bmw_customer", required: true, topic: "which BMW model you own", text: "Which BMW model do you own, and what do you love most about it?", anchor: "which bmw model" },
    { id: "q10", audience: "bmw_customer", required: true, topic: "whether you'd buy another BMW", text: "How likely are you to purchase another BMW in the future? What would make you consider switching brands?" },
    { id: "q11", audience: "bmw_customer", required: true, topic: "what BMW could improve", text: "What could BMW improve to make your ownership experience even better?" },

    { id: "q7", audience: "potential_bmw_customer", required: true, topic: "whether you've considered a BMW", text: "Have you ever considered purchasing a BMW? Why or why not?" },
    { id: "q8", audience: "potential_bmw_customer", required: true, topic: "your impressions of the BMW brand", text: "What perceptions or impressions do you have of the BMW brand?" },
    { id: "q9", audience: "potential_bmw_customer", required: true, topic: "what it would take to switch to BMW", text: "What would it take for you to switch to BMW for your next vehicle purchase?" },
    { id: "q10", audience: "potential_bmw_customer", required: true, topic: "what your current brand does better", text: "Compared to BMW, what do you think your current brand does better?" },
    { id: "q11", audience: "potential_bmw_customer", required: true, topic: "which luxury brand you'd recommend", text: "If you were to recommend a luxury car brand to a friend, which would you choose and why?" },

    { id: "q12", audience: "all", required: true, topic: "anything else about your ownership experience", text: "Is there anything else you'd like to share about your vehicle ownership experience?", anchor: "anything else you'd like to share" },
  ],
};

/** The guide that one segment hears, in order. */
export function interviewGuideFor(segment: Outcome): InterviewQuestion[] {
  return study.interview.filter((q) => q.audience === "all" || q.audience === segment);
}
