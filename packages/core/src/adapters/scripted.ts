import type { ToolCall } from "../schema.js";
import { ASK_USER_TOOL, REQUEST_APPROVAL_TOOL } from "../gates.js";
import type { AgentAdapter, AgentRunInput, AgentRunOutput } from "./types.js";

/**
 * A scripted action. The agent's output is a LINEAR sequence of tool calls, and
 * gate scoring is ordering-sensitive (an approval only honors a mandated gate if
 * it precedes the gated call). So the script is an ordered list of actions, not
 * two separate buckets — interleaving is the thing under test.
 */
export type ScriptedAction =
  | { call: string; args?: unknown; result?: unknown }
  | {
      gate: "request_approval";
      summary: string;
      reason: string;
      target_tool?: string;
    }
  | { gate: "ask_user"; question: string; reason: string };

export interface ScriptedStep {
  /** Ordered actions the agent emits on this step. Default: none. */
  actions?: ScriptedAction[];
  /** Final text. Default: `Scripted response to: <prompt>`. */
  final_output?: string;
  /** Reported latency. Default: the adapter-level `latency_ms`. */
  latency_ms?: number;
}

/** `{ [task_id]: { [step_n]: ScriptedStep } }` — addressed exactly as authored. */
export type Script = Record<string, Record<number, ScriptedStep>>;

export interface ScriptedAdapterOptions {
  script: Script;
  model?: string;
  latency_ms?: number;
  /**
   * What to do when the script has no entry for a (task, step). `"throw"`
   * (default) turns a typo in a test fixture into a loud failure instead of a
   * silently empty step that still produces a plausible-looking artifact.
   */
  on_unscripted?: "throw" | "silent";
}

function toToolCall(action: ScriptedAction, prompt: string): ToolCall {
  if ("call" in action) {
    return {
      tool: action.call,
      args: action.args ?? { prompt },
      result: action.result ?? { ok: true, scripted: true },
    };
  }
  if (action.gate === "request_approval") {
    return {
      tool: REQUEST_APPROVAL_TOOL,
      args: {
        summary: action.summary,
        reason: action.reason,
        ...(action.target_tool ? { target_tool: action.target_tool } : {}),
      },
      result: { ok: true, scripted: true },
    };
  }
  return {
    tool: ASK_USER_TOOL,
    args: { question: action.question, reason: action.reason },
    result: { ok: true, scripted: true },
  };
}

/**
 * A deterministic adapter whose behaviour — including GATE behaviour — is
 * declared per (task, step).
 *
 * Why a sibling of `createMockAdapter` rather than an option on it: the mock's
 * contract is "a naive agent that calls every task tool it is offered, and never
 * gates". It backs the README quickstart and the diff demo, and its output is
 * load-bearing for those. Bolting a script onto it would give one exported
 * factory two unrelated behaviours and make "default behaviour unchanged" a
 * matter of reading carefully rather than a structural fact. This adapter is an
 * instrument for exercising the runner, not a reference agent.
 */
export function createScriptedAdapter(
  opts: ScriptedAdapterOptions,
): AgentAdapter {
  const { script } = opts;
  const model = opts.model ?? "scripted-1";
  const latency = opts.latency_ms ?? 0;
  const onUnscripted = opts.on_unscripted ?? "throw";

  return {
    name: "scripted",
    model,
    config: { scripted_tasks: Object.keys(script).sort() },
    async run(input: AgentRunInput): Promise<AgentRunOutput> {
      const step = script[input.task_id]?.[input.step_n];
      if (!step) {
        if (onUnscripted === "throw") {
          throw new Error(
            `scripted adapter: no script for task "${input.task_id}" step ${input.step_n}. ` +
              `Scripted: ${JSON.stringify(
                Object.fromEntries(
                  Object.entries(script).map(([t, steps]) => [
                    t,
                    Object.keys(steps).map(Number),
                  ]),
                ),
              )}`,
          );
        }
        return { tool_calls: [], final_output: "", latency_ms: latency };
      }
      return {
        tool_calls: (step.actions ?? []).map((a) => toToolCall(a, input.prompt)),
        final_output:
          step.final_output ?? `Scripted response to: ${input.prompt}`,
        latency_ms: step.latency_ms ?? latency,
      };
    },
  };
}
