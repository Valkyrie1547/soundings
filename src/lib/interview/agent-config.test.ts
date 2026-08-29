import { describe, expect, it } from "vitest";
import { buildAgentConfig, CLIENT_TOOLS, DYNAMIC_VARIABLES, TOOL_CONFIGS } from "./agent-config";

describe("TOOL_CONFIGS", () => {
  const mark = TOOL_CONFIGS.find((t) => t.name === CLIENT_TOOLS.markAnswered)!;
  const finish = TOOL_CONFIGS.find((t) => t.name === CLIENT_TOOLS.finish)!;

  it("defines both client tools by name", () => {
    expect(mark).toBeDefined();
    expect(finish).toBeDefined();
    expect(TOOL_CONFIGS).toHaveLength(2);
  });

  it("does not wait for a tool response", () => {
    expect(mark.expectsResponse).toBe(false);
    expect(finish.expectsResponse).toBe(false);
  });

  it("limits question_id to the required ids, without duplicates", () => {
    const props = mark.parameters?.properties as Record<string, { enum?: string[] }>;
    expect(props.question_id.enum).toEqual(["q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12"]);
    expect(mark.parameters?.required).toEqual(["question_id", "summary"]);
  });
});

describe("buildAgentConfig", () => {
  const config = buildAgentConfig(["tool_a", "tool_b"]);
  const agent = config.conversationConfig!.agent!;

  it("uses the opening_line variable as the first message", () => {
    expect(agent.firstMessage).toBe("{{opening_line}}");
    expect(agent.disableFirstMessageInterruptions).toBe(true);
  });

  it("attaches the given tool ids", () => {
    expect(agent.prompt!.toolIds).toEqual(["tool_a", "tool_b"]);
  });

  it("raises the maximum duration above the platform default", () => {
    expect(config.conversationConfig!.conversation!.maxDurationSeconds).toBe(1800);
  });

  it("gives every dynamic variable a placeholder", () => {
    const placeholders = (agent.dynamicVariables as { dynamicVariablePlaceholders: Record<string, unknown> }).dynamicVariablePlaceholders;
    for (const name of DYNAMIC_VARIABLES) expect(placeholders).toHaveProperty(name);
  });

  it("references every dynamic variable in the prompt or first message", () => {
    const text = `${agent.prompt!.prompt} ${agent.firstMessage}`;
    for (const name of DYNAMIC_VARIABLES) {
      if (name === "respondent_id" || name === "last_topic") continue; // Used by the server only.
      expect(text).toContain(`{{${name}}}`);
    }
  });
});
