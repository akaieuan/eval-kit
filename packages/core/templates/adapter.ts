/**
 * Custom agent adapter template.
 *
 * An adapter is the bridge between eval-kit's runner and your agent. You need
 * to implement a single `run()` method that takes a prompt + context and
 * returns tool_calls, final_output, and latency_ms.
 *
 * Swap the body of `run()` to call YOUR agent — REST API, local model,
 * whatever. The runner handles iteration, scoring, and artifact persistence.
 */

import type { AgentAdapter } from "@eval-kit/core/adapters";

export const myAgentAdapter: AgentAdapter = {
  name: "my-agent",
  model: "v0.1",
  config: {},

  async run({ prompt, context, expected_tools, prior_steps }) {
    const started = Date.now();

    // TODO: replace with a real call to your agent
    // -------------------------------------------
    // Example shape:
    //   const resp = await myAgent.chat({
    //     prompt,
    //     context,
    //     tools: expected_tools,
    //     history: prior_steps,
    //   });
    //   const tool_calls = resp.tool_calls.map(tc => ({
    //     tool: tc.name,
    //     args: tc.input,
    //     result: tc.output,
    //   }));
    //   return {
    //     tool_calls,
    //     final_output: resp.text,
    //     latency_ms: Date.now() - started,
    //   };
    // -------------------------------------------

    return {
      tool_calls: [],
      final_output: `[stub] ${prompt.slice(0, 80)}`,
      latency_ms: Date.now() - started,
    };
  },
};
