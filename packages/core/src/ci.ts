import type { Run, ScoredRun, StepScore } from "./schema.js";
import { aggregateScoredRun, type SuiteAggregate } from "./scoring.js";
import { diffRuns, type StepDiff } from "./diff.js";

export interface CiThresholds {
  /** Minimum aggregate tool-match accuracy (0..1) */
  minToolMatch?: number;
  /** Minimum distraction detection rate (0..1). Only checked if any distraction tasks exist. */
  minDistractionCatch?: number;
  /** Maximum tolerated pre_filled ratio — guards against automation creep */
  maxPrefilledRatio?: number;
}

export interface CiOutcome {
  pass: boolean;
  exitCode: number;
  aggregate?: SuiteAggregate;
  regressions: StepDiff[];
  violations: string[];
}

/**
 * Evaluate a fresh run (and optional baseline) against CI gates.
 * Only tier-1 auto-scored metrics can fail a build. Golden-truth regressions
 * are reported-only unless both runs are scored.
 */
export function evaluateCi(opts: {
  run: Run | ScoredRun;
  baseline?: ScoredRun;
  thresholds?: CiThresholds;
}): CiOutcome {
  const { run, baseline, thresholds = {} } = opts;
  const violations: string[] = [];

  // If run is scored, aggregate; else aggregate as if it were a scored run with no scores.
  const asScored: ScoredRun = ensureScoredShape(run);
  const agg = aggregateScoredRun(asScored);

  if (
    typeof thresholds.minToolMatch === "number" &&
    agg.tool_match_accuracy < thresholds.minToolMatch
  ) {
    violations.push(
      `tool_match_accuracy ${(agg.tool_match_accuracy * 100).toFixed(1)}% < threshold ${(thresholds.minToolMatch * 100).toFixed(0)}%`,
    );
  }
  if (
    typeof thresholds.minDistractionCatch === "number" &&
    agg.distraction_detection_rate !== null &&
    agg.distraction_detection_rate < thresholds.minDistractionCatch
  ) {
    violations.push(
      `distraction_detection_rate ${(agg.distraction_detection_rate * 100).toFixed(1)}% < threshold ${(thresholds.minDistractionCatch * 100).toFixed(0)}%`,
    );
  }

  if (typeof thresholds.maxPrefilledRatio === "number") {
    let total = 0;
    let prefilled = 0;
    for (const t of asScored.task_results) {
      for (const s of t.step_results) {
        total += 1;
        if (s.score?.pre_filled) prefilled += 1;
      }
    }
    const ratio = total > 0 ? prefilled / total : 0;
    if (ratio > thresholds.maxPrefilledRatio) {
      violations.push(
        `pre_filled ratio ${(ratio * 100).toFixed(1)}% > threshold ${(thresholds.maxPrefilledRatio * 100).toFixed(0)}% — automation exceeded`,
      );
    }
  }

  let regressions: StepDiff[] = [];
  if (baseline) {
    const diffs = diffRuns(baseline, asScored);
    regressions = diffs.filter((d) => d.kind === "regression");
    // Only tier-1 regressions count as failures for CI.
    const tierOneRegressions = regressions.filter((d) =>
      d.kind === "regression"
        ? d.reasons.some(
            (r) =>
              r.startsWith("tool_match") ||
              r.startsWith("distraction_caught"),
          )
        : false,
    );
    if (tierOneRegressions.length > 0) {
      violations.push(
        `${tierOneRegressions.length} tier-1 regression${
          tierOneRegressions.length === 1 ? "" : "s"
        } vs baseline`,
      );
    }
  }

  const pass = violations.length === 0;
  return {
    pass,
    exitCode: pass ? 0 : 1,
    aggregate: agg,
    regressions,
    violations,
  };
}

function ensureScoredShape(run: Run | ScoredRun): ScoredRun {
  return {
    ...run,
    task_results: run.task_results.map((t) => ({
      task_id: t.task_id,
      step_results: t.step_results.map((s) => {
        const maybe = s as unknown as { score?: StepScore | null };
        return { ...s, score: maybe.score ?? null };
      }),
    })),
  };
}
