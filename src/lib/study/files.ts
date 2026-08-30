import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseStudy, type StudyConfig, type StudyIssue } from "./schema";

/** The folder with one JSON file per study. The seed script and the agent tests read it. */
export const STUDIES_DIR = path.join(process.cwd(), "studies");

export interface StudyFile {
  file: string;
  study?: StudyConfig;
  issues?: StudyIssue[];
}

/** Reads and validates one file. A bad file returns its issues, it does not throw. */
export async function readStudyFile(file: string): Promise<StudyFile> {
  let json: unknown;
  try {
    json = JSON.parse(await readFile(file, "utf8"));
  } catch (err) {
    return { file, issues: [{ path: "", message: err instanceof Error ? err.message : "not JSON" }] };
  }
  return { file, ...parseStudy(json) };
}

/** Every `*.json` in `studies/`, in name order. */
export async function readStudyFiles(dir = STUDIES_DIR): Promise<StudyFile[]> {
  const names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  return Promise.all(names.map((n) => readStudyFile(path.join(dir, n))));
}

/** One study by id from `studies/<id>.json`. Throws when the file is missing or invalid. */
export async function loadStudyFile(id: string, dir = STUDIES_DIR): Promise<StudyConfig> {
  const result = await readStudyFile(path.join(dir, `${id}.json`));
  if (!result.study) {
    const detail = result.issues?.map((i) => `${i.path}: ${i.message}`).join("; ") ?? "unknown error";
    throw new Error(`study file ${id}.json is invalid: ${detail}`);
  }
  return result.study;
}
