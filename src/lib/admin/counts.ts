import { sql } from "drizzle-orm";
import { db } from "@/db";
import { respondents } from "@/db/schema";

export interface StudyCounts {
  total: number;
  qualified: number;
  completed: number;
}

/** Respondent counts for every study, in one grouped query. */
export async function respondentCounts(): Promise<Map<string, StudyCounts>> {
  const rows = await db()
    .select({
      studyId: respondents.studyId,
      total: sql<number>`count(*)`,
      qualified: sql<number>`count(*) filter (where ${respondents.surveyStatus} = 'qualified')`,
      completed: sql<number>`count(*) filter (where ${respondents.interviewStatus} = 'completed')`,
    })
    .from(respondents)
    .groupBy(respondents.studyId);
  return new Map(rows.map((r) => [r.studyId, { total: Number(r.total), qualified: Number(r.qualified), completed: Number(r.completed) }]));
}
