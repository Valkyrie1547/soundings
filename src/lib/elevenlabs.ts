import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/** Server only. The API key does not go to the browser. The server gives the browser signed URLs. */
let cached: ElevenLabsClient | undefined;

export function elevenlabs() {
  if (!cached) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
    cached = new ElevenLabsClient({ apiKey });
  }
  return cached;
}

export function agentId() {
  const id = process.env.ELEVENLABS_AGENT_ID;
  if (!id) throw new Error("ELEVENLABS_AGENT_ID is not set");
  return id;
}
