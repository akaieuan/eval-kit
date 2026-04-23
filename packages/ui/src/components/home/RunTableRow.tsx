"use client";
import type { Run, ScoredRun } from "@eval-kit/core";
import { aggregateScoredRun } from "@eval-kit/core";
import { cn } from "../../lib/cn.js";
import { Sparkline } from "../primitives/sparkline.js";

export interface RunTableRowProps {
  run: Run | ScoredRun;
  scored?: boolean;
  href?: string;
}

function relative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function RunTableRow({ run, scored, href }: RunTableRowProps) {
  const agg = scored ? aggregateScoredRun(run as ScoredRun) : null;

  // Flatten per-step scores for the sparkline — use golden_truth if scored, else
  // map auto-scored tool_match (true=3, partial=1.5, false=0) so unscored runs still visualize.
  const sparkValues: number[] = [];
  for (const t of run.task_results) {
    for (const s of t.step_results) {
      if (scored) {
        const scoredStep = s as unknown as { score?: { golden_truth: number | null } };
        const gt = scoredStep.score?.golden_truth;
        if (typeof gt === "number") sparkValues.push(gt);
      } else {
        const tm = s.auto_score.tool_match;
        sparkValues.push(tm === true ? 3 : tm === "partial" ? 1.5 : 0);
      }
    }
  }

  const RowWrap = href ? "a" : "div";
  const rowProps = href ? { href } : {};

  return (
    <RowWrap
      {...(rowProps as Record<string, unknown>)}
      className={cn(
        "group grid grid-cols-[120px_1fr_180px_72px_72px_120px_80px] items-center gap-3 border-b border-border/60 px-4 py-3 text-[13px] transition-colors hover:bg-bg-elev-2/50 last:border-b-0",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            scored ? "bg-good" : "bg-warn",
          )}
        />
        <code className="font-mono text-xs text-fg-muted">
          {run.run_id.slice(0, 6)}
        </code>
      </div>
      <div className="min-w-0 truncate">
        <span className="text-fg">{run.suite_id}</span>
        <span className="text-fg-muted-2"> @{run.suite_version}</span>
      </div>
      <div className="truncate text-fg-muted">
        {run.adapter.name}
        <span className="text-fg-muted-2">/{run.adapter.model}</span>
      </div>
      <div className="text-fg-muted tabular-nums">
        {agg ? `${(agg.tool_match_accuracy * 100).toFixed(0)}%` : "—"}
      </div>
      <div className="text-fg tabular-nums">
        {agg && agg.golden_truth_pass_rate !== null
          ? `${(agg.golden_truth_pass_rate * 100).toFixed(0)}%`
          : "—"}
      </div>
      <div className="flex items-center">
        <Sparkline
          values={sparkValues}
          max={3}
          threshold={2}
          width={100}
          height={18}
        />
      </div>
      <div className="text-right text-2xs text-fg-muted-2 tabular-nums">
        {relative(run.started_at)}
      </div>
    </RowWrap>
  );
}
