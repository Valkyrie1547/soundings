import { z } from "zod";

/**
 * The shape of one study, as a zod schema. A study is a JSON document. The
 * files in `studies/` and the rows in the `studies` table both have this
 * shape. Every module that needs study content takes a `StudyConfig`
 * parameter. No module reads a global study.
 *
 * The schema also checks the relations inside the document: an audience
 * must name a segment, a qualify effect must name a segment, and so on. A
 * study that passes `StudySchema` cannot make the engine or the agent fail
 * on a missing reference.
 */

/** Ids inside a document: options, segments, questions. */
const Slug = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, "use lower-case letters, digits, underscores, and hyphens");
/** The study id goes in the URL, so it has no underscores. */
const UrlSlug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "use lower-case letters, digits, and hyphens");

const OptionEffectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("terminate") }),
  z.object({ kind: z.literal("qualify"), outcome: Slug }),
]);

const OptionSchema = z.object({
  id: Slug,
  label: z.string().min(1),
  effect: OptionEffectSchema.optional(),
});

const BaseQuestion = {
  id: Slug,
  prompt: z.string().min(1),
  options: z.array(OptionSchema).min(2),
};

const QuestionSchema = z.discriminatedUnion("type", [
  z.object({ ...BaseQuestion, type: z.literal("single") }),
  z.object({
    ...BaseQuestion,
    type: z.literal("multi"),
    /** Text for the eyebrow label, for example "Select all that apply". */
    hint: z.string().optional(),
  }),
]);

const InterviewQuestionSchema = z.object({
  id: Slug,
  /** The respondents that hear this question: every segment, or one segment id. */
  audience: z.string().min(1),
  /** True when the question counts for completion. The readiness check does not count. */
  required: z.boolean(),
  /** The words the moderator speaks. */
  text: z.string().min(1),
  /** A short label for the progress list and for the resume greeting. */
  topic: z.string().min(1),
  /**
   * A short phrase from the spoken wording. The transcript backstop matches
   * this phrase when the agent paraphrases the question. Use it only where
   * word overlap with `text` is weak.
   */
  anchor: z.string().optional(),
});

const SegmentSchema = z.object({
  id: Slug,
  /** How the agent describes the respondent, for example "Current BMW owner". */
  label: z.string().min(1),
  /** The short name on the transcript page, for example "BMW Customer". */
  transcriptLabel: z.string().min(1),
});

const ColorPair = z.object({ light: z.string().min(1), dark: z.string().min(1) });

/** Respondent-facing sentences that name the subject of the study. Each one has a default. */
const CopySchema = z.object({
  /** The body of the "you qualify" screen. */
  qualified: z.string().optional(),
  /** The body of the "screened out" screen. */
  screenedOut: z.string().optional(),
  /** The heading before the first interview session. */
  interviewHeading: z.string().optional(),
  /** The body before the first interview session. `{total}` is the question count. */
  interviewBody: z.string().optional(),
});

const StudyShape = z.object({
  /** The slug in the URL: `/s/<id>`. */
  id: UrlSlug,
  /** Starts at 1. A published change gets the next number. A respondent keeps the version they started with. */
  version: z.number().int().min(1),
  /** The product name. It shows in the header. */
  name: z.string().min(1),
  /** The study title that respondents see. */
  title: z.string().min(1),
  theme: z.object({ accent: ColorPair, onAccent: ColorPair }),
  copy: CopySchema.optional(),
  segments: z.array(SegmentSchema).min(1),
  screening: z.array(QuestionSchema).min(1),
  /** The interview guide in order. The engine filters it by segment at runtime. */
  interview: z.array(InterviewQuestionSchema).min(2),
  /**
   * Precedence for a multi-select answer that has more than one qualify
   * option. The first segment in this list wins.
   */
  outcomePrecedence: z.array(Slug).min(1),
});

export type StudyConfig = z.infer<typeof StudyShape>;
export type Segment = z.infer<typeof SegmentSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type SingleSelectQuestion = Extract<Question, { type: "single" }>;
export type MultiSelectQuestion = Extract<Question, { type: "multi" }>;
export type Option = z.infer<typeof OptionSchema>;
export type OptionEffect = z.infer<typeof OptionEffectSchema>;
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;
/** A segment id. It is a string, because segments are data. */
export type Outcome = string;

type Ctx = z.RefinementCtx;

function issue(ctx: Ctx, path: (string | number)[], message: string) {
  ctx.addIssue({ code: "custom", path, message });
}

/** Every value in `ids` must be unique. Reports each repeat at its own path. */
function checkUnique(ctx: Ctx, ids: string[], pathFor: (index: number) => (string | number)[], what: string) {
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (seen.has(id)) issue(ctx, pathFor(index), `duplicate ${what} "${id}"`);
    seen.add(id);
  });
}

function checkScreening(study: StudyConfig, segments: Set<string>, ctx: Ctx) {
  checkUnique(ctx, study.screening.map((q) => q.id), (i) => ["screening", i, "id"], "screening id");
  let endsSomewhere = false;
  study.screening.forEach((q, qi) => {
    checkUnique(ctx, q.options.map((o) => o.id), (oi) => ["screening", qi, "options", oi, "id"], "option id");
    q.options.forEach((o, oi) => {
      if (o.effect) endsSomewhere = true;
      if (o.effect?.kind === "qualify" && !segments.has(o.effect.outcome)) {
        issue(ctx, ["screening", qi, "options", oi, "effect", "outcome"], `unknown segment "${o.effect.outcome}"`);
      }
    });
  });
  if (!endsSomewhere) issue(ctx, ["screening"], "no option qualifies or terminates, so the survey never ends");
  const qualifies = study.screening.some((q) => q.options.some((o) => o.effect?.kind === "qualify"));
  if (!qualifies) issue(ctx, ["screening"], "no option qualifies, so nobody reaches the interview");
}

function checkInterview(study: StudyConfig, segments: Set<string>, ctx: Ctx) {
  const pairs = study.interview.map((q) => `${q.id}|${q.audience}`);
  checkUnique(ctx, pairs, (i) => ["interview", i, "id"], "interview id for the same audience");
  study.interview.forEach((q, i) => {
    if (q.audience !== "all" && !segments.has(q.audience)) {
      issue(ctx, ["interview", i, "audience"], `unknown segment "${q.audience}"`);
    }
  });
  if (study.interview[0].required) {
    issue(ctx, ["interview", 0, "required"], "the first interview question is the readiness check and must not be required");
  }
  for (const s of study.segments) {
    const count = study.interview.filter((q) => q.required && (q.audience === "all" || q.audience === s.id)).length;
    if (count === 0) issue(ctx, ["interview"], `segment "${s.id}" has no required question`);
  }
}

function checkSegments(study: StudyConfig, segments: Set<string>, ctx: Ctx) {
  checkUnique(ctx, study.segments.map((s) => s.id), (i) => ["segments", i, "id"], "segment id");
  study.outcomePrecedence.forEach((id, i) => {
    if (!segments.has(id)) issue(ctx, ["outcomePrecedence", i], `unknown segment "${id}"`);
  });
  for (const s of study.segments) {
    if (!study.outcomePrecedence.includes(s.id)) {
      issue(ctx, ["outcomePrecedence"], `segment "${s.id}" is missing from the precedence list`);
    }
  }
}

export const StudySchema = StudyShape.superRefine((study, ctx) => {
  const segments = new Set(study.segments.map((s) => s.id));
  checkSegments(study, segments, ctx);
  checkScreening(study, segments, ctx);
  checkInterview(study, segments, ctx);
});

export interface StudyIssue {
  path: string;
  message: string;
}

/** Parses unknown JSON into a study, or returns the issues with dotted paths. */
export function parseStudy(input: unknown): { study: StudyConfig; issues?: never } | { study?: never; issues: StudyIssue[] } {
  const result = StudySchema.safeParse(input);
  if (result.success) return { study: result.data };
  return {
    issues: result.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
  };
}
