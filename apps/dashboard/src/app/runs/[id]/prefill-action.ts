"use server";
import {
  prefillRunScores,
  type PrefillScoreResult,
} from "@eval-kit/core/anthropic/prefill-score";
import type {
  Dimension,
  EvalTask,
  StepScore,
  TaskResult,
} from "@eval-kit/core";
import { loadRunById, loadSuiteById } from "@/lib/runs";

export interface PrefillForTaskRequest {
  runId: string;
  taskId: string;
  /** Step numbers to pre-fill. If empty, fills all unscored. */
  onlyStepNs?: number[];
}

export interface PrefilledStepOutcome {
  step_n: number;
  ok: boolean;
  score?: StepScore;
  confidence?: number;
  error?: string;
}

export async function prefillScoresForTask(
  req: PrefillForTaskRequest,
): Promise<
  | { ok: true; outcomes: PrefilledStepOutcome[] }
  | { ok: false; error: string }
> {
  const entry = await loadRunById(req.runId);
  if (!entry) return { ok: false, error: "Run not found." };
  const suite = await loadSuiteById(entry.run.suite_id);
  if (!suite) return { ok: false, error: "Suite not found." };

  const task: EvalTask | undefined = suite.suite.tasks.find(
    (t) => t.id === req.taskId,
  );
  const taskResult: TaskResult | undefined = entry.run.task_results.find(
    (t) => t.task_id === req.taskId,
  );
  if (!task || !taskResult) {
    return { ok: false, error: "Task not found in run/suite." };
  }

  const wanted =
    req.onlyStepNs && req.onlyStepNs.length > 0
      ? new Set(req.onlyStepNs)
      : null;

  const payload = taskResult.step_results
    .filter((sr) => (wanted ? wanted.has(sr.step_n) : true))
    .map((sr) => {
      const step = task.steps.find((s) => s.n === sr.step_n)!;
      const dims: Dimension[] =
        step.scoring_hints.dimensions.length > 0
          ? step.scoring_hints.dimensions
          : suite.suite.dimensions_in_scope;
      return { step, result: sr, dimensions: dims };
    });

  try {
    const results: PrefillScoreResult[] = await prefillRunScores({
      task,
      steps: payload,
    });

    const outcomes: PrefilledStepOutcome[] = results.map((r, i) => {
      const stepN = payload[i]!.step.n;
      if (r.ok) {
        return {
          step_n: stepN,
          ok: true,
          score: r.score,
          confidence: r.confidence,
        };
      }
      return { step_n: stepN, ok: false, error: r.error };
    });

    return { ok: true, outcomes };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "prefill failed",
    };
  }
}
