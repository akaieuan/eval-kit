import type { ScoredRun, StepScore } from "./schema.js";

export type StepDiff =
  | { kind: "only_in_a"; task_id: string; step_n: number }
  | { kind: "only_in_b"; task_id: string; step_n: number }
  | {
      kind: "regression";
      task_id: string;
      step_n: number;
      reasons: string[];
      a: { tool_match: unknown; score: StepScore | null };
      b: { tool_match: unknown; score: StepScore | null };
    }
  | {
      kind: "improvement";
      task_id: string;
      step_n: number;
      reasons: string[];
      a: { tool_match: unknown; score: StepScore | null };
      b: { tool_match: unknown; score: StepScore | null };
    }
  | { kind: "unchanged"; task_id: string; step_n: number };

export function diffRuns(a: ScoredRun, b: ScoredRun): StepDiff[] {
  const diffs: StepDiff[] = [];
  const aIdx = indexSteps(a);
  const bIdx = indexSteps(b);

  const keys = new Set<string>([...aIdx.keys(), ...bIdx.keys()]);
  for (const key of keys) {
    const [task_id, stepStr] = key.split("::");
    const step_n = Number(stepStr);
    const aStep = aIdx.get(key);
    const bStep = bIdx.get(key);
    if (!aStep) {
      diffs.push({ kind: "only_in_b", task_id: task_id!, step_n });
      continue;
    }
    if (!bStep) {
      diffs.push({ kind: "only_in_a", task_id: task_id!, step_n });
      continue;
    }
    const reasons: string[] = [];
    let direction: "regression" | "improvement" | null = null;

    if (aStep.auto_score.tool_match !== bStep.auto_score.tool_match) {
      const worse =
        toolMatchRank(bStep.auto_score.tool_match) <
        toolMatchRank(aStep.auto_score.tool_match);
      reasons.push(
        `tool_match: ${String(aStep.auto_score.tool_match)} → ${String(bStep.auto_score.tool_match)}`,
      );
      direction = worse ? "regression" : "improvement";
    }

    if (
      aStep.auto_score.distraction_caught !== bStep.auto_score.distraction_caught
    ) {
      reasons.push(
        `distraction_caught: ${String(aStep.auto_score.distraction_caught)} → ${String(bStep.auto_score.distraction_caught)}`,
      );
      if (
        aStep.auto_score.distraction_caught === true &&
        bStep.auto_score.distraction_caught === false
      ) {
        direction = "regression";
      } else if (
        aStep.auto_score.distraction_caught === false &&
        bStep.auto_score.distraction_caught === true
      ) {
        direction = direction ?? "improvement";
      }
    }

    const aGt = aStep.score?.golden_truth ?? null;
    const bGt = bStep.score?.golden_truth ?? null;
    if (aGt !== null && bGt !== null && aGt !== bGt) {
      reasons.push(`golden_truth: ${aGt} → ${bGt}`);
      direction = bGt < aGt ? "regression" : direction ?? "improvement";
    }

    const aDims = aStep.score?.dimensions ?? {};
    const bDims = bStep.score?.dimensions ?? {};
    for (const dim of new Set([
      ...Object.keys(aDims),
      ...Object.keys(bDims),
    ])) {
      const av = (aDims as Record<string, number>)[dim];
      const bv = (bDims as Record<string, number>)[dim];
      if (av !== bv && typeof av === "number" && typeof bv === "number") {
        reasons.push(`${dim}: ${av} → ${bv}`);
        if (bv < av) direction = "regression";
        else if (direction !== "regression") direction = "improvement";
      }
    }

    if (reasons.length === 0) {
      diffs.push({ kind: "unchanged", task_id: task_id!, step_n });
    } else {
      diffs.push({
        kind: direction ?? "improvement",
        task_id: task_id!,
        step_n,
        reasons,
        a: { tool_match: aStep.auto_score.tool_match, score: aStep.score ?? null },
        b: { tool_match: bStep.auto_score.tool_match, score: bStep.score ?? null },
      });
    }
  }
  return diffs.sort((x, y) => {
    const tCmp = x.task_id.localeCompare(y.task_id);
    return tCmp !== 0 ? tCmp : x.step_n - y.step_n;
  });
}

function indexSteps(run: ScoredRun) {
  const map = new Map<
    string,
    {
      auto_score: ScoredRun["task_results"][number]["step_results"][number]["auto_score"];
      score: StepScore | null;
    }
  >();
  for (const task of run.task_results) {
    for (const step of task.step_results) {
      map.set(`${task.task_id}::${step.step_n}`, {
        auto_score: step.auto_score,
        score: step.score ?? null,
      });
    }
  }
  return map;
}

function toolMatchRank(v: unknown): number {
  if (v === true) return 2;
  if (v === "partial") return 1;
  return 0;
}
