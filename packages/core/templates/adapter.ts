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

  async run({ prompt, context, toolbox, prior_steps }) {
    const started = Date.now();

    // TODO: replace with a real call to your agent
    // -------------------------------------------
    // `toolbox` is the full tool universe for the suite — offer all of it to
    // your agent on every step. The suite's per-step `expected_tools` is the
    // answer key and is deliberately not visible here: an adapter that only
    // offered the expected tools would be handing the agent the answer, and
    // tool selection would no longer be measured.
    //
    // Example shape:
    //   const resp = await myAgent.chat({
    //     prompt,
    //     context,
    //     tools: toolbox,
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
