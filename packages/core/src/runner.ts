import { randomUUID } from "node:crypto";
import type { AgentAdapter } from "./adapters/types.js";
import { autoScoreStep } from "./scoring.js";
import type {
  EvalSuite,
  EvalTask,
  Run,
  StepResult,
  TaskResult,
  ToolCall,
} from "./schema.js";

export interface RunnerOptions {
  adapter: AgentAdapter;
  onStepStart?: (task: EvalTask, stepN: number) => void;
  onStepComplete?: (task: EvalTask, result: StepResult) => void;
}

export async function runSuite(
  suite: EvalSuite,
  opts: RunnerOptions,
): Promise<Run> {
  const { adapter } = opts;
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
        prompt: step.prompt,
        context: task.context_items,
        expected_tools: step.expected_tools,
        prior_steps: prior,
      });
      const toolsCalled = out.tool_calls.map((t) => t.tool);
      const auto_score = autoScoreStep({
        step,
        task,
        toolsCalled,
        finalOutput: out.final_output,
      });
      const result: StepResult = {
        step_n: step.n,
        agent_tool_calls: out.tool_calls,
        agent_final_output: out.final_output,
        latency_ms: out.latency_ms,
        auto_score,
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
