/**
 * Creates or updates the ElevenLabs agent from src/lib/interview/agent-config.ts.
 *
 *   npm run agent:setup      (node --env-file=.env.local --import tsx scripts/setup-agent.ts)
 *
 * The script finds tools by name and updates them in place. It removes
 * extra tools that have the same name. When ELEVENLABS_AGENT_ID is not set,
 * the script creates a new agent and prints its id. When it is set, the
 * script updates that agent. It is safe to run the script again.
 */
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { buildAgentConfig, TOOL_CONFIGS } from "../src/lib/interview/agent-config";

/** One workspace tool for each name. Updates the first match and returns the other matches as strays. */
async function syncTools(client: ElevenLabsClient) {
  const { tools } = await client.conversationalAi.tools.list();
  const ids: string[] = [];
  const strays: string[] = [];

  for (const config of TOOL_CONFIGS) {
    const matches = tools.filter((t) => "name" in t.toolConfig && t.toolConfig.name === config.name);
    const [keep, ...extra] = matches;
    if (keep) {
      await client.conversationalAi.tools.update(keep.id, { toolConfig: config });
      ids.push(keep.id);
      console.log(`Updated tool ${config.name} (${keep.id})`);
    } else {
      const created = await client.conversationalAi.tools.create({ toolConfig: config });
      ids.push(created.id);
      console.log(`Created tool ${config.name} (${created.id})`);
    }
    strays.push(...extra.map((t) => t.id));
  }
  return { ids, strays };
}

/** Deletes stray tools. This is only possible when no agent refers to them. */
async function removeStrays(client: ElevenLabsClient, strays: string[]) {
  for (const id of strays) {
    await client.conversationalAi.tools.delete(id);
    console.log(`Removed duplicate tool ${id}`);
  }
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

  const client = new ElevenLabsClient({ apiKey });
  const { ids, strays } = await syncTools(client);
  const config = buildAgentConfig(ids);
  const existing = process.env.ELEVENLABS_AGENT_ID;

  if (existing) {
    const { conversationConfig, name, tags } = config;
    await client.conversationalAi.agents.update(existing, { conversationConfig, name, tags });
    console.log(`Updated agent ${existing}`);
    await removeStrays(client, strays);
    return;
  }

  const { agentId } = await client.conversationalAi.agents.create(config);
  console.log(`Created agent ${agentId}`);
  await removeStrays(client, strays);
  console.log(`\nAdd to .env.local and Vercel:\n  ELEVENLABS_AGENT_ID=${agentId}`);
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
