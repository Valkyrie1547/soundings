import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { studies } from "@/db/schema";
import { parseStudy, type StudyConfig } from "./schema";

/**
 * The study registry. Studies live in the `studies` table, one row for
 * each `(id, version)`. The row with the newest `published_at` for an id
 * is the live one. New respondents get the live version. A respondent who
 * has started keeps the version on their row.
 *
 * Caching: a version never changes, so `loadStudy` caches for the life of
 * the process. The live pointer can change, so `loadLiveStudy` caches for
 * a short time. `publishStudy` clears both in this process. Other
 * serverless instances see the new version when their live cache expires.
 */

const LIVE_TTL_MS = 30_000;

const byVersion = new Map<string, StudyConfig>();
const live = new Map<string, { study: StudyConfig; until: number }>();

function key(id: string, version: number) {
  return `${id}@${version}`;
}

/** Validates a stored row. A bad row is a server error, never a half-rendered survey. */
function fromRow(id: string, version: number, config: unknown): StudyConfig {
  const parsed = parseStudy(config);
  if (!parsed.study) {
    const first = parsed.issues[0];
    throw new Error(`stored study ${key(id, version)} is invalid at ${first.path}: ${first.message}`);
  }
  return parsed.study;
}

/** One exact version. Null when it does not exist. */
export async function loadStudy(id: string, version: number): Promise<StudyConfig | null> {
  const cached = byVersion.get(key(id, version));
  if (cached) return cached;
  const [row] = await db()
    .select({ config: studies.config })
    .from(studies)
    .where(and(eq(studies.id, id), eq(studies.version, version)));
  if (!row) return null;
  const study = fromRow(id, version, row.config);
  byVersion.set(key(id, version), study);
  return study;
}

/** The live version of one study. Null when the id is unknown. */
export async function loadLiveStudy(id: string): Promise<StudyConfig | null> {
  const cached = live.get(id);
  if (cached && cached.until > Date.now()) return cached.study;
  const [row] = await db()
    .select({ version: studies.version, config: studies.config })
    .from(studies)
    .where(eq(studies.id, id))
    .orderBy(desc(studies.publishedAt), desc(studies.version))
    .limit(1);
  if (!row) return null;
  const study = fromRow(id, row.version, row.config);
  live.set(id, { study, until: Date.now() + LIVE_TTL_MS });
  byVersion.set(key(id, row.version), study);
  return study;
}

export interface StudySummary {
  id: string;
  title: string;
  version: number;
  publishedAt: string;
}

/** The live version of every study, newest first. */
export async function listStudies(): Promise<StudySummary[]> {
  const rows = await db()
    .select({ id: studies.id, version: studies.version, config: studies.config, publishedAt: studies.publishedAt })
    .from(studies)
    .orderBy(desc(studies.publishedAt));
  const seen = new Set<string>();
  const out: StudySummary[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({ id: r.id, version: r.version, title: (r.config as StudyConfig).title, publishedAt: r.publishedAt.toISOString() });
  }
  return out;
}

/** JSON with sorted object keys. Zod re-orders keys on parse, so a plain stringify would differ. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** True when two studies have the same content, apart from `version`. */
export function sameContent(a: StudyConfig, b: StudyConfig): boolean {
  return canonical({ ...a, version: 0 }) === canonical({ ...b, version: 0 });
}

export type PublishResult = { ok: true; version: number } | { ok: false; reason: "unchanged" };

/**
 * Stores a new version. The version number is the next one for the id.
 * The given `version` field is ignored, so an admin cannot overwrite a
 * version that a respondent is using. Refuses when the body equals the
 * live version.
 */
export async function publishStudy(study: StudyConfig): Promise<PublishResult> {
  const current = await loadLiveStudy(study.id);
  if (current && sameContent(current, study)) return { ok: false, reason: "unchanged" };
  const [{ max }] = await db()
    .select({ max: sql<number>`coalesce(max(${studies.version}), 0)` })
    .from(studies)
    .where(eq(studies.id, study.id));
  const version = Number(max) + 1;
  const next = { ...study, version };
  await db().insert(studies).values({ id: study.id, version, config: next });
  live.delete(study.id);
  byVersion.set(key(study.id, version), next);
  return { ok: true, version };
}

/**
 * Stores one exact version from a file. Used by the seed script. Refuses
 * when the version exists with different content. Returns what happened.
 */
export async function seedStudy(study: StudyConfig): Promise<"inserted" | "same" | "conflict"> {
  const existing = await loadStudy(study.id, study.version);
  if (existing) return sameContent(existing, study) ? "same" : "conflict";
  await db().insert(studies).values({ id: study.id, version: study.version, config: study });
  live.delete(study.id);
  return "inserted";
}

/** Forgets every cached study. Tests call it. */
export function clearStudyCache() {
  byVersion.clear();
  live.clear();
}
