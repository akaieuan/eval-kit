import type { Run, ScoredRun } from "@eval-kit/core";
import { aggregateScoredRun } from "@eval-kit/core";
import { StatCard } from "../primitives/stat-card.js";
import { formatRatio, gateTotals } from "../../lib/gates.js";

export interface StatCardGroupProps {
  scoredRuns: ScoredRun[];
  unreviewedStepCount: number;
  /**
   * Every run, scored or not. Gate compliance is AUTO-scored — it exists the
   * moment a run is traced, unlike pass rate which waits on a human. Reading
   * gates off `scoredRuns` made the cards report "no gates declared" while
   * the runs table directly below showed 0/3 and 3/3 on unscored runs.
   * Optional so existing callers keep working; falls back to scoredRuns.
   */
  allRuns?: (Run | ScoredRun)[];
}

export function StatCardGroup({
  scoredRuns,
  unreviewedStepCount,
  allRuns,
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

  // Gates get three cards, never one. Mandated compliance is pass/fail per
  // gate and is shown as a COUNT — "11/12" reads as one unauthorized action,
  // where "92%" reads as a passing grade. Precision and recall stay apart
  // because over-asking and under-asking are different failures with
  // different costs. See README, "Two kinds of gate, never averaged".
  const gateSource = allRuns?.length
    ? [...allRuns].sort((a, b) => a.started_at.localeCompare(b.started_at))[
        allRuns.length - 1
      ]
    : latest;
  const gates = gateSource ? gateTotals(gateSource) : null;
  const complianceRatio = gates ? formatRatio(gates.honored, gates.required) : null;
  const precisionRatio = gates ? formatRatio(gates.matched, gates.asked) : null;
  const recallRatio = gates ? formatRatio(gates.matched, gates.blockers) : null;

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
      <StatCard
        label="Gate compliance"
        value={complianceRatio ?? "—"}
        sublabel={
          complianceRatio === null
            ? "no gates declared in this suite"
            : gates && gates.violated > 0
              ? `${gates.violated} unauthorized ${gates.violated === 1 ? "action" : "actions"}`
              : "approval preceded every gated call"
        }
      />
      <StatCard
        label="Ask precision"
        value={precisionRatio ?? "—"}
        sublabel={
          precisionRatio === null
            ? "the agent asked nothing"
            : gates && gates.unprompted > 0
              ? `${gates.unprompted} asked with no blocker`
              : "asks that addressed a blocker"
        }
      />
      <StatCard
        label="Blocker recall"
        value={recallRatio ?? "—"}
        sublabel={
          recallRatio === null
            ? "no blockers declared in this suite"
            : "declared blockers the agent surfaced"
        }
      />
    </div>
  );
}
