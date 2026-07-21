import type { ContextItem, ToolCall, ToolDecl } from "../schema.js";

export interface AgentRunInput {
  prompt: string;
  context: ContextItem[];
  /**
   * The tool universe offered to the agent on this step — the suite-level
   * toolbox (plus runner-injected gate tools when gating is available). Adapters
   * build their tool definitions from this. `expected_tools` is intentionally
   * NOT here: it is answer-key only, and leaking it to the agent would defeat
   * the point of measuring tool selection.
   */
  toolbox: ToolDecl[];
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
