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
import type { StudyConfig } from "@/lib/study/schema";

/**
 * One row for each published version of a study. The newest `published_at`
 * for an id is the live version. A version never changes after it is
 * stored. `config` has the shape of `StudySchema`.
 */
export const studies = pgTable(
  "studies",
  {
    id: text("id").notNull(),
    version: integer("version").notNull(),
    config: jsonb("config").$type<StudyConfig>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.id, t.version] })],
);

/**
 * The respondent row is the single source of truth for where a person is in
 * the journey. Each page load goes from respondent id, to this row, to the
 * screen. The row names the study and the version, so a published change
 * never re-shapes an interview in progress. The column defaults exist for
 * the rows that were made before studies were data.
 */
export const surveyStatusEnum = pgEnum("survey_status", ["in_progress", "screened_out", "qualified"]);
export const interviewStatusEnum = pgEnum("interview_status", ["not_started", "in_progress", "completed"]);

export const respondents = pgTable("respondents", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  studyId: text("study_id").notNull().default("vehicle-ownership"),
  studyVersion: integer("study_version").notNull().default(1),
  /** A segment id from the study. Text, because segments are data. */
  segment: text("segment"),
  surveyStatus: surveyStatusEnum("survey_status").notNull().default("in_progress"),
  interviewStatus: interviewStatusEnum("interview_status").notNull().default("not_started"),
});

/** One row for each answered question. The primary key makes a new answer an update. */
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

/** One row for each connection. N rows make one interview in N segments. */
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

/** Who marked a question: the agent's tool call, or the transcript backstop. */
export type ProgressSource = "tool" | "transcript";

/** A set. A question is answered when the agent marks it once. */
export const interviewProgress = pgTable(
  "interview_progress",
  {
    respondentId: uuid("respondent_id")
      .notNull()
      .references(() => respondents.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    summary: text("summary"),
    source: text("source").$type<ProgressSource>().notNull().default("tool"),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.respondentId, t.questionId] })],
);

export interface TranscriptTurn {
  role: "agent" | "user";
  message: string;
  timeInCallSecs: number;
}

/** One row for each conversation segment. The full interview is the ordered set of rows. */
export const transcripts = pgTable("transcripts", {
  conversationId: text("conversation_id").primaryKey(),
  respondentId: uuid("respondent_id")
    .notNull()
    .references(() => respondents.id, { onDelete: "cascade" }),
  transcript: jsonb("transcript").$type<TranscriptTurn[]>().notNull(),
  summary: text("summary"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});
