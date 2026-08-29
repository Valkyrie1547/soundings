/**
 * Study configuration — the single source of truth for one study.
 *
 * Everything respondent-facing that is specific to *this* study lives here:
 * the name, the accent colour, the screening questions and their branching,
 * and (later) the interview guide. Swap this file, swap the study.
 *
 * Deliberately sponsor-blind: nothing here names the sponsor brand in
 * respondent-facing copy. Brand names only appear where the respondent is
 * asked to self-report them.
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
  /** Shown as the eyebrow, e.g. "Select all that apply". */
  hint?: string;
}

export type Question = SingleSelectQuestion | MultiSelectQuestion;

export interface StudyConfig {
  /** Product name shown in the header. */
  name: string;
  /** Respondent-facing study title. */
  title: string;
  theme: {
    accent: { light: string; dark: string };
    onAccent: { light: string; dark: string };
  };
  screening: Question[];
  /**
   * When a multi-select answer mixes qualifying and terminating brands,
   * qualification wins, and the first outcome listed here wins over later
   * ones. Documented assumption: a respondent who owns a BMW and a Toyota
   * is still a BMW owner.
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
};
