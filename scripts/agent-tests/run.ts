/**
 * Runs the agent simulation scenarios against the live agent.
 *
 *   npm run agent:test -- [--only <name>] [--repeat N] [--json] [--yes]
 *
 * Each run costs platform credit, so the script prints the estimated turn
 * count first and needs `--yes` or `CI=1` for more than three scenarios.
 * Simulations are not deterministic. `--repeat N` runs each scenario N
 * times and compares the pass rate with the scenario's threshold.
 * `--json` writes `scripts/agent-tests/last-run.json` with the transcripts.
 * The API key is never printed.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { simulate, type Scenario, type ScenarioResult } from "./harness";
import { scenarios } from "./scenarios";

interface Options {
  only?: string;
  repeat: number;
  json: boolean;
  yes: boolean;
}

interface Summary {
  name: string;
  passes: number;
  runs: number;
  rate: number;
  ok: boolean;
}

const MAX_WITHOUT_CONFIRM = 3;
const JSON_PATH = path.join(process.cwd(), "scripts", "agent-tests", "last-run.json");

/** Reads the value after a flag, or undefined when the flag is absent. */
function flagValue(argv: string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at >= 0 ? argv[at + 1] : undefined;
}

function parseOptions(argv: string[]): Options {
  const repeat = Number(flagValue(argv, "--repeat") ?? "1");
  if (!Number.isInteger(repeat) || repeat < 1) throw new Error("--repeat needs a whole number of 1 or more");
  return {
    only: flagValue(argv, "--only"),
    repeat,
    json: argv.includes("--json"),
    yes: argv.includes("--yes") || process.env.CI === "1",
  };
}

function selectScenarios(only: string | undefined): Scenario[] {
  if (!only) return scenarios;
  const found = scenarios.filter((s) => s.name === only);
  if (found.length === 0) throw new Error(`no scenario named "${only}". Known: ${scenarios.map((s) => s.name).join(", ")}`);
  return found;
}

/** Refuses the run when it would cost more than the caller confirmed. */
function guardCost(selected: Scenario[], options: Options): void {
  const turns = selected.reduce((sum, s) => sum + s.newTurnsLimit, 0) * options.repeat;
  const runs = selected.length * options.repeat;
  console.log(`${runs} simulation run(s), at most ${turns} new turns.`);
  if (runs > MAX_WITHOUT_CONFIRM && !options.yes) {
    throw new Error(`More than ${MAX_WITHOUT_CONFIRM} runs. Pass --yes or set CI=1 to confirm.`);
  }
}

function line(result: ScenarioResult): string {
  if (result.ok) return `PASS ${result.name} ${result.turns} turns ${result.seconds}s`;
  return `FAIL ${result.name}: ${result.error} (${result.turns} turns ${result.seconds}s)`;
}

async function runScenario(
  client: ElevenLabsClient,
  agentId: string,
  scenario: Scenario,
  repeat: number,
): Promise<{ summary: Summary; results: ScenarioResult[] }> {
  const results: ScenarioResult[] = [];
  for (let i = 0; i < repeat; i += 1) {
    const result = await simulate(client, agentId, scenario);
    console.log(line(result));
    results.push(result);
  }
  const passes = results.filter((r) => r.ok).length;
  const rate = passes / repeat;
  return { summary: { name: scenario.name, passes, runs: repeat, rate, ok: rate >= scenario.passRate }, results };
}

function printSummary(summaries: Summary[]): void {
  console.log("");
  for (const s of summaries) {
    const pct = Math.round(s.rate * 100);
    console.log(`${s.ok ? "pass" : "FAIL"}  ${s.name}  ${s.passes}/${s.runs} (${pct}%)`);
  }
  const failed = summaries.filter((s) => !s.ok).length;
  console.log(`\n${summaries.length - failed} passed, ${failed} failed`);
}

/** Reads one required variable. The value is never printed. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const agentId = requireEnv("ELEVENLABS_AGENT_ID");
  const apiKey = requireEnv("ELEVENLABS_API_KEY");

  const selected = selectScenarios(options.only);
  guardCost(selected, options);

  const client = new ElevenLabsClient({ apiKey });
  const summaries: Summary[] = [];
  const all: ScenarioResult[] = [];
  for (const scenario of selected) {
    const { summary, results } = await runScenario(client, agentId, scenario, options.repeat);
    summaries.push(summary);
    all.push(...results);
  }

  printSummary(summaries);
  if (options.json) {
    await writeFile(JSON_PATH, JSON.stringify({ ranAt: new Date().toISOString(), summaries, results: all }, null, 2));
    console.log(`Wrote ${JSON_PATH}`);
  }
  if (summaries.some((s) => !s.ok)) process.exit(1);
}

main().catch((err) => {
  console.error(err?.body ?? err?.message ?? err);
  process.exit(1);
});
