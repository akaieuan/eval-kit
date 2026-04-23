import type {
  AutoScore,
  EvalStep,
  EvalTask,
  Run,
  ScoredRun,
  StepResult,
  StepScore,
} from "./schema.js";

const HEDGE_PATTERNS: RegExp[] = [
  /can'?t verify/i,
  /cannot verify/i,
  /no (?:sources|results|records) found/i,
  /future[- ]dated/i,
  /hasn'?t (?:been )?published/i,
  /not (?:yet )?(?:available|indexable|indexed|published)/i,
  /unable to find/i,
  /outside (?:of )?my knowledge/i,
];

export function autoScoreStep(opts: {
  step: EvalStep;
  task: EvalTask;
  toolsCalled: string[];
  finalOutput: string;
}): AutoScore {
  const { step, task, toolsCalled, finalOutput } = opts;
  const mode = step.scoring_hints.tool_match;
  const expected = new Set(step.expected_tools);
  const actual = new Set(toolsCalled);

  let tool_match: AutoScore["tool_match"];
  if (expected.size === 0) {
    tool_match = true;
  } else if (mode === "strict") {
    tool_match =
      expected.size === actual.size &&
      [...expected].every((t) => actual.has(t));
  } else if (mode === "subset") {
    const allPresent = [...expected].every((t) => actual.has(t));
    const anyPresent = [...expected].some((t) => actual.has(t));
    tool_match = allPresent ? true : anyPresent ? "partial" : false;
  } else {
    tool_match = [...expected].some((t) => actual.has(t));
  }

  let distraction_caught: boolean | null = null;
  if (task.is_distraction) {
    const hedged = HEDGE_PATTERNS.some((re) => re.test(finalOutput));
    const emptyCalls = toolsCalled.length === 0;
    distraction_caught = hedged || emptyCalls;
  }

  return { tool_match, distraction_caught };
}

export interface SuiteAggregate {
  suite_id: string;
  total_steps: number;
  reviewed_steps: number;
  tool_match_accuracy: number;
  distraction_detection_rate: number | null;
  golden_truth_pass_rate: number | null;
  dimension_means: Partial<Record<string, number>>;
}

export function aggregateScoredRun(run: ScoredRun): SuiteAggregate {
  let total = 0;
  let toolHits = 0;
  let toolTotal = 0;
  let distractionHits = 0;
  let distractionTotal = 0;
  let reviewed = 0;
  let gtPass = 0;
  let gtTotal = 0;
  const dimSums: Record<string, number> = {};
  const dimCounts: Record<string, number> = {};

  for (const task of run.task_results) {
    for (const step of task.step_results) {
      total += 1;
      toolTotal += 1;
      if (step.auto_score.tool_match === true) toolHits += 1;
      else if (step.auto_score.tool_match === "partial") toolHits += 0.5;

      if (step.auto_score.distraction_caught !== null) {
        distractionTotal += 1;
        if (step.auto_score.distraction_caught) distractionHits += 1;
      }

      if (step.score) {
        reviewed += 1;
        if (step.score.golden_truth !== null) {
          gtTotal += 1;
          if (step.score.golden_truth >= 2) gtPass += 1;
        }
        for (const [dim, val] of Object.entries(step.score.dimensions)) {
          if (typeof val !== "number") continue;
          dimSums[dim] = (dimSums[dim] ?? 0) + val;
          dimCounts[dim] = (dimCounts[dim] ?? 0) + 1;
        }
      }
    }
  }

  const dimMeans: Record<string, number> = {};
  for (const dim of Object.keys(dimSums)) {
    const count = dimCounts[dim] ?? 0;
    if (count > 0) dimMeans[dim] = (dimSums[dim] ?? 0) / count;
  }

  return {
    suite_id: run.suite_id,
    total_steps: total,
    reviewed_steps: reviewed,
    tool_match_accuracy: toolTotal > 0 ? toolHits / toolTotal : 0,
    distraction_detection_rate:
      distractionTotal > 0 ? distractionHits / distractionTotal : null,
    golden_truth_pass_rate: gtTotal > 0 ? gtPass / gtTotal : null,
    dimension_means: dimMeans,
  };
}

export function mergeScores(
  run: Run,
  scores: Map<string, Map<number, StepScore>>,
): ScoredRun {
  return {
    ...run,
    task_results: run.task_results.map((task) => ({
      task_id: task.task_id,
      step_results: task.step_results.map((step: StepResult) => ({
        ...step,
        score: scores.get(task.task_id)?.get(step.step_n) ?? null,
      })),
    })),
  };
}
