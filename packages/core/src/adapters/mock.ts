import { ASK_USER_TOOL, REQUEST_APPROVAL_TOOL, isGateTool } from "../gates.js";
import type { AgentAdapter, AgentRunInput, AgentRunOutput } from "./types.js";
import type { ToolCall } from "../schema.js";

export interface MockAdapterOptions {
  model?: string;
  degraded?: boolean;
  latency_ms?: number;
  /**
   * How the mock treats runner-injected gate tools.
   *
   * - `"bypass"` (default, the historical behavior): ignore them entirely —
   *   task tools are called with no approval, so every triggered mandated
   *   gate scores as violated. This is the "output looks fine, authorization
   *   never happened" agent.
   * - `"honor"`: emit one `request_approval` per tool listed in
   *   `approveTools`, each naming that tool, and emit an `ask_user` when the
   *   step prompt matches `askOn`.
   */
  gateBehavior?: "honor" | "bypass";
  /**
   * In `"honor"` mode: prompts matching this pattern get an `ask_user` whose
   * question echoes the prompt. Deterministic stand-in for judgment — a
   * blocker whose `description` is a phrase of the prompt will match it.
   */
  askOn?: RegExp;
  /**
   * Tools this mock requests approval for before calling, one approval each,
   * naming the tool. The mock cannot infer which tools are gated because
   * AgentRunInput carries no mandated_gates, and approving the whole toolbox
   * would emit nonsense approvals for un-gated tools. Only consulted in
   * `gateBehavior: "honor"` mode.
   */
  approveTools?: string[];
}

/**
 * Deterministic reference adapter. A naive agent that calls every TASK tool
 * offered in the toolbox. `degraded: true` calls nothing, to simulate a
 * regression for the diff demo. `gateBehavior` controls whether it respects
 * runner-injected gate tools (see MockAdapterOptions). It builds its "tool
 * defs" from `input.toolbox`, never `expected_tools` (which it no longer
 * sees).
 */
export function createMockAdapter(opts: MockAdapterOptions = {}): AgentAdapter {
  const model = opts.model ?? "mock-1";
  const degraded = opts.degraded ?? false;
  const latency = opts.latency_ms ?? 10;
  const gateBehavior = opts.gateBehavior ?? "bypass";
  const askOn = opts.askOn;
  const approveTools = opts.approveTools ?? [];
  return {
    name: "mock",
    model,
    config: {
      degraded,
      latency_ms: latency,
      gate_behavior: gateBehavior,
      // RegExp doesn't survive JSON; record the source so run artifacts stay
      // self-describing.
      ...(askOn ? { ask_on: askOn.source } : {}),
      ...(approveTools.length > 0 ? { approve_tools: approveTools } : {}),
    },
    async run(input: AgentRunInput): Promise<AgentRunOutput> {
      await new Promise((r) => setTimeout(r, latency));
      const gatePrefix: ToolCall[] = [];
      if (!degraded && gateBehavior === "honor") {
        const offered = new Set(input.toolbox.map((t) => t.name));
        if (offered.has(REQUEST_APPROVAL_TOOL)) {
          // One approval per tool the caller declared gated, each NAMING that
          // tool. The previous version emitted a single untargeted approval,
          // which under v2 rules authorizes nothing, and meant no shipped
          // fixture ever exercised targeted approval.
          for (const name of approveTools) {
            if (!offered.has(name)) continue;
            gatePrefix.push({
              tool: REQUEST_APPROVAL_TOOL,
              args: {
                reason: "mock honor mode: approval precedes this action",
                summary: `Requesting approval to call ${name}`,
                target_tool: name,
                uses: 1,
              },
              result: { ok: true, mock: true },
            });
          }
        }
        if (offered.has(ASK_USER_TOOL) && askOn?.test(input.prompt)) {
          gatePrefix.push({
            tool: ASK_USER_TOOL,
            args: {
              reason: "mock honor mode: prompt matched askOn",
              question: input.prompt,
            },
            result: { ok: true, mock: true },
          });
        }
      }
      const tool_calls = degraded
        ? []
        : [
            ...gatePrefix,
            ...input.toolbox
              .filter((t) => !isGateTool(t.name))
              .map((t) => ({
                tool: t.name,
                args: { prompt: input.prompt },
                result: { ok: true, mock: true },
              })),
          ];
      const final_output = degraded
        ? "I'm not sure, and I couldn't attempt the task."
        : `Mock response to: ${input.prompt.slice(0, 120)}`;
      return { tool_calls, final_output, latency_ms: latency };
    },
  };
}
