/**
 * Create or update the ElevenLabs agent from src/lib/interview/agent-config.ts.
 *
 *   npm run agent:setup      (node --env-file=.env.local --import tsx scripts/setup-agent.ts)
 *
 * Tools are matched by name and updated in place (strays with the same name
 * are removed). With ELEVENLABS_AGENT_ID unset, a new agent is created and
 * its id printed; with it set, that agent is updated. Safe to re-run.
 */
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { buildAgentConfig, TOOL_CONFIGS } from "../src/lib/interview/agent-config";

/** One workspace tool per name: update the first match, report the rest as strays. */
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

/** Strays can only be deleted once no agent references them. */
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
