"use server";
import {
  mergeScores,
  parseRun,
  parseScoredRun,
  type RubricScore,
  type ScoredRun,
  type StepScore,
} from "@eval-kit/core";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { reviewerIdentity } from "@/lib/env";
import { RUNS_DIR, listRuns, writeScoredRun } from "@/lib/runs";

export interface InlineScoreRequest {
  run_id: string;
  task_id: string;
  step_n: number;
  golden_truth?: RubricScore | null;
  /** When present, flips pre_filled=false if true */
  accept?: boolean;
  reviewer_notes?: string;
}

export async function scoreStepInline(
  req: InlineScoreRequest,
): Promise<
  | { ok: true; run_id: string; saved_at: string }
  | { ok: false; error: string }
> {
  try {
    const scored = await loadScoredRunByIdOrBase(req.run_id);
    if (!scored) return { ok: false, error: "Run not found." };

    const existingScoresMap = new Map<string, Map<number, StepScore>>();
    for (const t of scored.task_results) {
      const inner = new Map<number, StepScore>();
      for (const s of t.step_results) {
        if (s.score) inner.set(s.step_n, s.score);
      }
      existingScoresMap.set(t.task_id, inner);
    }

    const taskMap =
      existingScoresMap.get(req.task_id) ?? new Map<number, StepScore>();
    const current = taskMap.get(req.step_n);
    const autoToolMatch =
      scored.task_results
        .find((t) => t.task_id === req.task_id)
        ?.step_results.find((s) => s.step_n === req.step_n)?.auto_score
        .tool_match ?? false;
    const autoDistraction =
      scored.task_results
        .find((t) => t.task_id === req.task_id)
        ?.step_results.find((s) => s.step_n === req.step_n)?.auto_score
        .distraction_caught ?? null;

    const updated: StepScore = {
      step_n: req.step_n,
      tool_match: current?.tool_match ?? autoToolMatch,
      golden_truth:
        req.golden_truth !== undefined
          ? req.golden_truth
          : (current?.golden_truth ?? null),
      distraction_caught: current?.distraction_caught ?? autoDistraction,
      dimensions: current?.dimensions ?? {},
      reviewer_notes:
        req.reviewer_notes !== undefined
          ? req.reviewer_notes
          : (current?.reviewer_notes ?? ""),
      reviewer_id: reviewerIdentity(),
      reviewed_at: new Date().toISOString(),
      pre_filled: req.accept
        ? false
        : req.golden_truth !== undefined
          ? false
          : (current?.pre_filled ?? false),
    };

    taskMap.set(req.step_n, updated);
    existingScoresMap.set(req.task_id, taskMap);
    const next = mergeScores(scored, existingScoresMap);
    await writeScoredRun(next);

    revalidatePath("/");
    revalidatePath("/inbox");
    revalidatePath(`/runs/${req.run_id}`);

    return { ok: true, run_id: req.run_id, saved_at: new Date().toISOString() };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "save failed",
    };
  }
}

async function loadScoredRunByIdOrBase(
  runId: string,
): Promise<ScoredRun | null> {
  const runs = await listRuns();
  const match = runs.find((r) => r.run.run_id === runId);
  if (!match) return null;
  if (match.status === "scored") {
    return match.run as ScoredRun;
  }
  // Unscored — upgrade to a scored shape by attaching null scores.
  const raw = await readFile(join(RUNS_DIR, match.file), "utf8");
  const base = parseRun(JSON.parse(raw));
  const shaped = parseScoredRun({
    ...base,
    task_results: base.task_results.map((t) => ({
      task_id: t.task_id,
      step_results: t.step_results.map((s) => ({ ...s, score: null })),
    })),
  });
  return shaped;
}
