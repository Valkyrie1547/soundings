import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The respondent row is the single source of truth for where someone is in
 * the journey. Every page load resolves respondent id → this row → screen.
 */
export const segmentEnum = pgEnum("segment", ["bmw_customer", "potential_bmw_customer"]);
export const surveyStatusEnum = pgEnum("survey_status", ["in_progress", "screened_out", "qualified"]);
export const interviewStatusEnum = pgEnum("interview_status", ["not_started", "in_progress", "completed"]);

export const respondents = pgTable("respondents", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  segment: segmentEnum("segment"),
  surveyStatus: surveyStatusEnum("survey_status").notNull().default("in_progress"),
  interviewStatus: interviewStatusEnum("interview_status").notNull().default("not_started"),
});

/** One row per answered question; the unique key makes re-answering an upsert. */
export const surveyAnswers = pgTable(
  "survey_answers",
  {
    respondentId: uuid("respondent_id")
      .notNull()
      .references(() => respondents.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    answer: jsonb("answer").$type<string | string[]>().notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.respondentId, t.questionId] })],
);

/** One row per (re)connection. N rows = one interview in N segments. */
export const interviewSessions = pgTable("interview_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  respondentId: uuid("respondent_id")
    .notNull()
    .references(() => respondents.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id"),
  attemptNo: integer("attempt_no").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  endReason: text("end_reason").$type<"completed" | "dropped" | "user_ended">(),
});

/** Set semantics: a question is answered once the agent marks it, ever. */
export const interviewProgress = pgTable(
  "interview_progress",
  {
    respondentId: uuid("respondent_id")
      .notNull()
      .references(() => respondents.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    summary: text("summary"),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.respondentId, t.questionId] })],
);

export interface TranscriptTurn {
  role: "agent" | "user";
  message: string;
  timeInCallSecs: number;
}

/** One row per conversation segment; the full interview is the ordered set. */
export const transcripts = pgTable("transcripts", {
  conversationId: text("conversation_id").primaryKey(),
  respondentId: uuid("respondent_id")
    .notNull()
    .references(() => respondents.id, { onDelete: "cascade" }),
  transcript: jsonb("transcript").$type<TranscriptTurn[]>().notNull(),
  summary: text("summary"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});
