import type { AgentAdapter, AgentRunInput, AgentRunOutput } from "./types.js";

export interface MockAdapterOptions {
  model?: string;
  degraded?: boolean;
  latency_ms?: number;
}

export function createMockAdapter(opts: MockAdapterOptions = {}): AgentAdapter {
  const model = opts.model ?? "mock-1";
  const degraded = opts.degraded ?? false;
  const latency = opts.latency_ms ?? 10;
  return {
    name: "mock",
    model,
    config: { degraded, latency_ms: latency },
    async run(input: AgentRunInput): Promise<AgentRunOutput> {
      await new Promise((r) => setTimeout(r, latency));
      const tool_calls = degraded
        ? []
        : input.expected_tools.map((tool) => ({
            tool,
            args: { prompt: input.prompt },
            result: { ok: true, mock: true },
          }));
      const final_output = degraded
        ? "I'm not sure, and I couldn't attempt the task."
        : `Mock response to: ${input.prompt.slice(0, 120)}`;
      return { tool_calls, final_output, latency_ms: latency };
    },
  };
}
