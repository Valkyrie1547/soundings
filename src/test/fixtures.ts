import { readFileSync } from "node:fs";
import path from "node:path";
import { StudySchema, type StudyConfig } from "@/lib/study/schema";

/**
 * Test fixtures. The two sample studies come from `studies/` so a test
 * proves the code on the documents that ship. `makeStudy` builds a small
 * study with overrides for tests that need one shape only.
 */
function readSample(id: string): StudyConfig {
  const file = path.join(process.cwd(), "studies", `${id}.json`);
  return StudySchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

export const vehicleStudy: StudyConfig = readSample("vehicle-ownership");
export const coffeeStudy: StudyConfig = readSample("coffee-subscription");

/** A minimal valid study: two segments, one screening question, three interview questions. */
export function makeStudy(overrides: Partial<StudyConfig> = {}): StudyConfig {
  return {
    id: "tiny",
    version: 1,
    name: "Soundings",
    title: "Tiny study",
    theme: { accent: { light: "#000000", dark: "#ffffff" }, onAccent: { light: "#ffffff", dark: "#000000" } },
    segments: [
      { id: "a", label: "Segment A", transcriptLabel: "A" },
      { id: "b", label: "Segment B", transcriptLabel: "B" },
    ],
    outcomePrecedence: ["a", "b"],
    screening: [
      {
        id: "pick",
        type: "single",
        prompt: "Pick one",
        options: [
          { id: "a", label: "A", effect: { kind: "qualify", outcome: "a" } },
          { id: "b", label: "B", effect: { kind: "qualify", outcome: "b" } },
          { id: "none", label: "None", effect: { kind: "terminate" } },
        ],
      },
    ],
    interview: [
      { id: "q1", audience: "all", required: false, topic: "getting started", text: "Ready?" },
      { id: "q2", audience: "all", required: true, topic: "the first thing", text: "Tell me the first thing." },
      { id: "q3", audience: "a", required: true, topic: "the A thing", text: "Tell me the A thing." },
      { id: "q3", audience: "b", required: true, topic: "the B thing", text: "Tell me the B thing." },
    ],
    ...overrides,
  };
}
