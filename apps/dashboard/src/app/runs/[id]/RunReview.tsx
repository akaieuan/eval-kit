"use client";
import type {
  EvalSuite,
  Run,
  ScoredRun,
  StepScore,
} from "@eval-kit/core";
import {
  RunReviewPage,
  recordScoreInSession,
  type PrefillResult,
} from "@eval-kit/ui";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveScoredRun } from "./actions";
import { prefillScoresForTask } from "./prefill-action";

export interface RunReviewProps {
  suite: EvalSuite;
  run: Run;
  initialScores: Array<{ task_id: string; score: StepScore }>;
  prefillAvailable: boolean;
}

export function RunReview({
  suite,
  run,
  initialScores,
  prefillAvailable,
}: RunReviewProps) {
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const committedStepsRef = useRef<Set<string>>(
    new Set(
      initialScores
        .filter(({ score }) => !score.pre_filled && score.golden_truth !== null)
        .map(({ task_id, score }) => `${task_id}::${score.step_n}`),
    ),
  );

  const handleSave = useCallback((scored: ScoredRun) => {
    setError(null);
    // Bump session counter for any step that newly counts as "committed"
    // (human score present, not pre_filled). Fires once per step, regardless
    // of how many edits the user made to it.
    for (const task of scored.task_results) {
      for (const step of task.step_results) {
        const s = step.score;
        if (!s) continue;
        if (s.pre_filled) continue;
        if (s.golden_truth === null) continue;
        const key = `${task.task_id}::${step.step_n}`;
        if (!committedStepsRef.current.has(key)) {
          committedStepsRef.current.add(key);
          recordScoreInSession();
        }
      }
    }
    startTransition(async () => {
      const res = await saveScoredRun(scored);
      if (res.ok) {
        setSavedAt(new Date());
      } else {
        setError(res.error);
        toast.error("Save failed", { description: res.error });
      }
    });
  }, []);

  const handlePrefill = useCallback(
    async (taskId: string): Promise<PrefillResult[]> => {
      const res = await prefillScoresForTask({ runId: run.run_id, taskId });
      if (!res.ok) {
        toast.error("Pre-fill failed", { description: res.error });
        throw new Error(res.error);
      }
      const okCount = res.outcomes.filter((o) => o.ok).length;
      toast.success(`Drafted ${okCount} step${okCount === 1 ? "" : "s"}`, {
        description: "Review + adjust. Any edit flips it to your score.",
      });
      return res.outcomes.map<PrefillResult>((o) =>
        o.ok && o.score
          ? {
              step_n: o.step_n,
              ok: true,
              score: o.score,
              confidence: o.confidence,
            }
          : { step_n: o.step_n, ok: false, error: o.error ?? "unknown" },
      );
    },
    [run.run_id],
  );

  return (
    <RunReviewPage
      suite={suite}
      run={run}
      reviewerId="local"
      initialScores={initialScores}
      onScoreChange={handleSave}
      onPrefillTask={handlePrefill}
      prefillAvailable={prefillAvailable}
      saving={pending}
      savedAt={savedAt}
      saveError={error}
    />
  );
}
