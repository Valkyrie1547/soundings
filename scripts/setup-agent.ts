/**
 * Create or update the ElevenLabs agent from src/lib/interview/agent-config.ts.
 *
 *   node --env-file=.env.local --import tsx scripts/setup-agent.ts
 *
 * With ELEVENLABS_AGENT_ID unset, creates a new agent and prints its id.
 * With it set, updates that agent in place. Safe to re-run.
 */
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { buildAgentConfig } from "../src/lib/interview/agent-config";

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

  const client = new ElevenLabsClient({ apiKey });
  const config = buildAgentConfig();
  const existing = process.env.ELEVENLABS_AGENT_ID;

  if (existing) {
    const { conversationConfig, name, tags } = config;
    await client.conversationalAi.agents.update(existing, { conversationConfig, name, tags });
    console.log(`Updated agent ${existing}`);
    return;
  }

  const { agentId } = await client.conversationalAi.agents.create(config);
  console.log(`Created agent ${agentId}`);
  console.log(`\nAdd to .env.local and Vercel:\n  ELEVENLABS_AGENT_ID=${agentId}`);
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
