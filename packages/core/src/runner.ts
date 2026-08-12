import { randomUUID } from "node:crypto";
import type { AgentAdapter } from "./adapters/types.js";
import { GATE_TOOLBOX, isGateTool } from "./gates.js";
import { autoScoreStep, type GateCall } from "./scoring.js";
import { runStepVerifiers } from "./verifiers/index.js";
import type {
  AutoScore,
  EvalStep,
  EvalSuite,
  EvalTask,
  GateEvent,
  Run,
  StepResult,
  TaskResult,
  ToolCall,
  ToolDecl,
} from "./schema.js";

/**
 * The complete auto-scoring pass for one step: rubric scoring plus verifiers.
 *
 * Exported because replay needs it. Re-scoring a recorded run through a
 * *parallel* implementation would only prove that two implementations agree —
 * the golden harness has to enter the same door the live runner does.
 */
export function scoreStep(opts: {
  step: EvalStep;
  task: EvalTask;
  toolsCalled: string[];
  finalOutput: string;
  gateCalls: GateCall[];
}): AutoScore {
  return {
    ...autoScoreStep(opts),
    verification: runStepVerifiers(opts.step, opts.task, opts.finalOutput),
  };
}

export interface GateResolution {
  resolution: GateEvent["resolution"];
  /** The answer returned to an `ask_user` gate (recorded as `answered`). */
  answer?: string;
}

export interface GatingOptions {
  /** The phase-5 A/B switch. `available` injects the gate tools; default `available`. */
  mode?: "available" | "unavailable";
  /**
   * Scripted resolutions for deterministic replay. Default: approve every
   * approval request; answer every question with `step.gate_response ?? ""`.
   */
  respond?: (
    ev: GateEvent,
    ctx: { task: EvalTask; step: EvalStep },
  ) => GateResolution;
}

export interface RunnerOptions {
  adapter: AgentAdapter;
  gating?: GatingOptions;
  onStepStart?: (task: EvalTask, stepN: number) => void;
  onStepComplete?: (task: EvalTask, result: StepResult) => void;
}

/**
 * The tool universe offered to the agent. Computed once per suite: the explicit
 * suite-level toolbox if present, otherwise (legacy suites) the union of every
 * step's `expected_tools` — preserving old suites while still killing per-step
 * tool leakage. Gate tools are injected separately, per run.
 */
export function resolveToolbox(suite: EvalSuite): ToolDecl[] {
  if (suite.suite.toolbox.length > 0) return suite.suite.toolbox;
  const seen = new Set<string>();
  const union: ToolDecl[] = [];
  for (const task of suite.suite.tasks) {
    for (const step of task.steps) {
      for (const name of step.expected_tools) {
        if (seen.has(name)) continue;
        seen.add(name);
        union.push({ name });
      }
    }
  }
  return union;
}

function readStr(args: unknown, key: string): string {
  if (args && typeof args === "object" && key in args) {
    const v = (args as Record<string, unknown>)[key];
    if (typeof v === "string") return v;
  }
  return "";
}

export async function runSuite(
  suite: EvalSuite,
  opts: RunnerOptions,
): Promise<Run> {
  const { adapter } = opts;
  const gateMode = opts.gating?.mode ?? "available";
  const respond = opts.gating?.respond;
  const baseToolbox = resolveToolbox(suite);
  const toolbox =
    gateMode === "available" ? [...baseToolbox, ...GATE_TOOLBOX] : baseToolbox;

  const started_at = new Date().toISOString();
  const task_results: TaskResult[] = [];

  for (const task of suite.suite.tasks) {
    const step_results: StepResult[] = [];
    const prior: Array<{
      prompt: string;
      tool_calls: ToolCall[];
      final_output: string;
    }> = [];
    for (const step of task.steps) {
      opts.onStepStart?.(task, step.n);
      const out = await adapter.run({
        task_id: task.id,
        step_n: step.n,
        prompt: step.prompt,
        context: task.context_items,
        toolbox,
        prior_steps: prior,
      });

      // Split gate calls out of the action sequence: they are meta-actions,
      // recorded as gate_events and excluded from agent_tool_calls.
      //
      // In the "unavailable" arm the gate tools were never offered, so a
      // gate-named call is an agent inventing a tool that does not exist.
      // Recording it as a gate would credit the control arm with a handoff
      // the human never received, contaminating the A/B. It stays in
      // agent_tool_calls as what it was — a call to an unavailable tool.
      // (Attempted gates remain countable: filter agent_tool_calls by
      // isGateTool.)
      const taskCalls: ToolCall[] = [];
      const gateEvents: GateEvent[] = [];
      const gateCalls: GateCall[] = [];
      for (const call of out.tool_calls) {
        if (gateMode === "unavailable" || !isGateTool(call.tool)) {
          taskCalls.push(call);
          continue;
        }
        const kind: GateEvent["kind"] =
          call.tool === "request_approval" ? "approval_request" : "question";
        const surfaced =
          kind === "approval_request"
            ? readStr(call.args, "summary")
            : readStr(call.args, "question");
        const target_tool =
          kind === "approval_request"
            ? readStr(call.args, "target_tool") || null
            : null;
        const reason = readStr(call.args, "reason");
        const defaultResolution: GateEvent["resolution"] =
          kind === "approval_request" ? "approved" : "answered";
        const draft: GateEvent = {
          kind,
          reason,
          surfaced,
          target_tool,
          resolution: defaultResolution,
          task_calls_before: taskCalls.length,
          // Task 4 will thread the budget from the gate tool's args. For now, null
          // (which resolves to 1 at scoring time) is the honest default.
          uses: null,
        };
        const resolved = respond?.(draft, { task, step });
        gateEvents.push(
          resolved ? { ...draft, resolution: resolved.resolution } : draft,
        );
        gateCalls.push({
          kind,
          reason,
          surfaced,
          target_tool,
          task_calls_before: taskCalls.length,
          uses: draft.uses,
        });
      }

      const auto_score = scoreStep({
        step,
        task,
        toolsCalled: taskCalls.map((t) => t.tool),
        finalOutput: out.final_output,
        gateCalls,
      });

      const result: StepResult = {
        step_n: step.n,
        agent_tool_calls: taskCalls,
        agent_final_output: out.final_output,
        latency_ms: out.latency_ms,
        auto_score,
        gate_events: gateEvents,
      };
      step_results.push(result);
      prior.push({
        prompt: step.prompt,
        tool_calls: out.tool_calls,
        final_output: out.final_output,
      });
      opts.onStepComplete?.(task, result);
    }
    task_results.push({ task_id: task.id, step_results });
  }

  const ended_at = new Date().toISOString();

  return {
    suite_id: suite.suite.id,
    suite_version: suite.suite.version,
    run_id: randomUUID(),
    started_at,
    ended_at,
    adapter: {
      name: adapter.name,
      model: adapter.model,
      config: adapter.config,
    },
    task_results,
  };
}
