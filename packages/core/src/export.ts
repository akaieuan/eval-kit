import type {
  EvalSuite,
  ScoredRun,
  StepScore,
} from "./schema.js";

export type ExportFormat = "sft" | "dpo" | "raw";

export interface SftRecord {
  prompt: string;
  completion: string;
  tool_calls: Array<{ tool: string; args?: unknown; result?: unknown }>;
  label: {
    golden_truth: number | null;
    tool_match: boolean | "partial";
    distraction_caught: boolean | null;
    pre_filled: boolean;
    dimensions: Record<string, number>;
  };
  metadata: {
    run_id: string;
    suite_id: string;
    task_id: string;
    step_n: number;
    adapter: string;
    model: string;
    latency_ms: number;
    reviewer_id: string | null;
  };
}

export interface DpoRecord {
  prompt: string;
  chosen: string;
  rejected: string;
  metadata: {
    task_id: string;
    step_n: number;
    chosen: { run_id: string; golden_truth: number | null };
    rejected: { run_id: string; golden_truth: number | null };
  };
}

export interface ExportOptions {
  minGoldenTruth?: number;
  includePreFilled?: boolean;
  /** Optional — when provided, export records include real step prompts. */
  suite?: EvalSuite;
}

function promptFor(
  suite: EvalSuite | undefined,
  task_id: string,
  step_n: number,
): string {
  if (!suite) return `[prompt @ ${task_id}::${step_n}]`;
  const task = suite.suite.tasks.find((t) => t.id === task_id);
  const step = task?.steps.find((s) => s.n === step_n);
  return step?.prompt ?? `[prompt @ ${task_id}::${step_n}]`;
}

/**
 * SFT export: one record per scored step. Pass `opts.suite` to include real
 * step prompts (otherwise a placeholder is used).
 */
export function exportSft(
  run: ScoredRun,
  opts: ExportOptions = {},
): SftRecord[] {
  const includePre = opts.includePreFilled ?? false;
  const out: SftRecord[] = [];
  for (const task of run.task_results) {
    for (const sr of task.step_results) {
      const s = sr.score;
      if (!s) continue;
      if (!includePre && s.pre_filled) continue;
      if (
        typeof opts.minGoldenTruth === "number" &&
        (s.golden_truth === null || s.golden_truth < opts.minGoldenTruth)
      ) {
        continue;
      }
      out.push({
        prompt: promptFor(opts.suite, task.task_id, sr.step_n),
        completion: sr.agent_final_output,
        tool_calls: sr.agent_tool_calls,
        label: {
          golden_truth: s.golden_truth,
          tool_match: s.tool_match,
          distraction_caught: s.distraction_caught,
          pre_filled: s.pre_filled,
          dimensions: s.dimensions as Record<string, number>,
        },
        metadata: {
          run_id: run.run_id,
          suite_id: run.suite_id,
          task_id: task.task_id,
          step_n: sr.step_n,
          adapter: run.adapter.name,
          model: run.adapter.model,
          latency_ms: sr.latency_ms,
          reviewer_id: s.reviewer_id,
        },
      });
    }
  }
  return out;
}

/**
 * DPO export: for each (task_id, step_n) present in both runs with distinct
 * golden_truth scores, emit (chosen = higher, rejected = lower).
 */
export function exportDpo(
  a: ScoredRun,
  b: ScoredRun,
  opts: { suite?: EvalSuite } = {},
): DpoRecord[] {
  const aIndex = indexByStep(a, opts.suite);
  const bIndex = indexByStep(b, opts.suite);
  const out: DpoRecord[] = [];
  for (const [key, aEntry] of aIndex) {
    const bEntry = bIndex.get(key);
    if (!bEntry) continue;
    const aGt = aEntry.score?.golden_truth;
    const bGt = bEntry.score?.golden_truth;
    if (typeof aGt !== "number" || typeof bGt !== "number") continue;
    if (aGt === bGt) continue;
    const chosen = aGt > bGt ? aEntry : bEntry;
    const rejected = aGt > bGt ? bEntry : aEntry;
    out.push({
      prompt: chosen.prompt,
      chosen: chosen.completion,
      rejected: rejected.completion,
      metadata: {
        task_id: chosen.task_id,
        step_n: chosen.step_n,
        chosen: {
          run_id: chosen.run_id,
          golden_truth: chosen.score?.golden_truth ?? null,
        },
        rejected: {
          run_id: rejected.run_id,
          golden_truth: rejected.score?.golden_truth ?? null,
        },
      },
    });
  }
  return out;
}

export function exportRaw(
  run: ScoredRun,
  opts: { suite?: EvalSuite } = {},
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const task of run.task_results) {
    for (const sr of task.step_results) {
      out.push({
        run_id: run.run_id,
        suite_id: run.suite_id,
        task_id: task.task_id,
        step_n: sr.step_n,
        prompt: promptFor(opts.suite, task.task_id, sr.step_n),
        agent_final_output: sr.agent_final_output,
        agent_tool_calls: sr.agent_tool_calls,
        auto_score: sr.auto_score,
        score: sr.score,
        latency_ms: sr.latency_ms,
      });
    }
  }
  return out;
}

export function toJsonl(records: Array<Record<string, unknown>>): string {
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

function indexByStep(run: ScoredRun, suite?: EvalSuite) {
  const map = new Map<
    string,
    {
      task_id: string;
      step_n: number;
      prompt: string;
      completion: string;
      score: StepScore | null;
      run_id: string;
    }
  >();
  for (const task of run.task_results) {
    for (const sr of task.step_results) {
      map.set(`${task.task_id}::${sr.step_n}`, {
        task_id: task.task_id,
        step_n: sr.step_n,
        prompt: promptFor(suite, task.task_id, sr.step_n),
        completion: sr.agent_final_output,
        score: sr.score ?? null,
        run_id: run.run_id,
      });
    }
  }
  return map;
}
