import type { ContextItem, ToolCall } from "../schema.js";

export interface AgentRunInput {
  prompt: string;
  context: ContextItem[];
  expected_tools: string[];
  prior_steps: Array<{
    prompt: string;
    tool_calls: ToolCall[];
    final_output: string;
  }>;
}

export interface AgentRunOutput {
  tool_calls: ToolCall[];
  final_output: string;
  latency_ms: number;
}

export interface AgentAdapter {
  name: string;
  model: string;
  config: Record<string, unknown>;
  run(input: AgentRunInput): Promise<AgentRunOutput>;
}
