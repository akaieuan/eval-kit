import type { ScoredRun } from "@eval-kit/core";
import { aggregateScoredRun } from "@eval-kit/core";
import { StatCard } from "../primitives/stat-card.js";

export interface StatCardGroupProps {
  scoredRuns: ScoredRun[];
  unreviewedStepCount: number;
}

export function StatCardGroup({
  scoredRuns,
  unreviewedStepCount,
}: StatCardGroupProps) {
  const sorted = [...scoredRuns].sort((a, b) =>
    a.started_at.localeCompare(b.started_at),
  );
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  const latestAgg = latest ? aggregateScoredRun(latest) : null;
  const prevAgg = previous ? aggregateScoredRun(previous) : null;

  const passRatePct = latestAgg?.golden_truth_pass_rate ?? null;
  const prevPassRatePct = prevAgg?.golden_truth_pass_rate ?? null;
  const passDelta =
    passRatePct !== null && prevPassRatePct !== null
      ? Math.round((passRatePct - prevPassRatePct) * 100)
      : null;

  const toolAcc = latestAgg?.tool_match_accuracy ?? null;
  const prevToolAcc = prevAgg?.tool_match_accuracy ?? null;
  const toolDelta =
    toolAcc !== null && prevToolAcc !== null
      ? Math.round((toolAcc - prevToolAcc) * 100)
      : null;

  // Count regressions vs prior (golden_truth drop or tool_match flip worse)
  let regressions = 0;
  if (latest && previous) {
    const prevMap = new Map<string, number>();
    for (const t of previous.task_results) {
      for (const s of t.step_results) {
        const key = `${t.task_id}::${s.step_n}`;
        const scoredStep = s as unknown as { score?: { golden_truth: number | null } };
        if (typeof scoredStep.score?.golden_truth === "number") {
          prevMap.set(key, scoredStep.score.golden_truth);
        }
      }
    }
    for (const t of latest.task_results) {
      for (const s of t.step_results) {
        const key = `${t.task_id}::${s.step_n}`;
        const scoredStep = s as unknown as { score?: { golden_truth: number | null } };
        const prev = prevMap.get(key);
        const curr = scoredStep.score?.golden_truth;
        if (typeof prev === "number" && typeof curr === "number" && curr < prev) {
          regressions += 1;
        }
      }
    }
  }

  // Trend sparkline = pass rate per run
  const passTrend = sorted
    .map((r) => aggregateScoredRun(r).golden_truth_pass_rate)
    .filter((v): v is number => v !== null);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
      <StatCard
        label="Pass rate"
        value={
          passRatePct !== null ? `${Math.round(passRatePct * 100)}%` : "—"
        }
        sublabel={latest ? `latest run` : "no scored runs"}
        delta={
          passDelta !== null
            ? { value: passDelta, suffix: "%" }
            : undefined
        }
        sparkline={passTrend.length > 1 ? passTrend : undefined}
        sparklineMax={1}
      />
      <StatCard
        label="Tool-match accuracy"
        value={toolAcc !== null ? `${Math.round(toolAcc * 100)}%` : "—"}
        sublabel="auto-scored"
        delta={
          toolDelta !== null ? { value: toolDelta, suffix: "%" } : undefined
        }
      />
      <StatCard
        label="Regressions"
        value={regressions}
        sublabel={previous ? "vs prior run" : "no prior to compare"}
      />
      <StatCard
        label="Unreviewed steps"
        value={unreviewedStepCount}
        sublabel="steps pending a human score"
      />
    </div>
  );
}
