import type { StepDiff } from "@eval-kit/core";
import { cn } from "../../lib/cn.js";

export interface DiffRowProps {
  diff: StepDiff;
  className?: string;
}

export function DiffRow({ diff, className }: DiffRowProps) {
  if (diff.kind === "unchanged") return null;

  const border =
    diff.kind === "regression"
      ? "border-l-danger/80"
      : diff.kind === "improvement"
        ? "border-l-good/80"
        : "border-l-fg-muted-2/50";

  const label =
    diff.kind === "regression"
      ? "Regression"
      : diff.kind === "improvement"
        ? "Improvement"
        : diff.kind === "only_in_a"
          ? "Only in A"
          : "Only in B";

  const labelColor =
    diff.kind === "regression"
      ? "text-danger"
      : diff.kind === "improvement"
        ? "text-good"
        : "text-fg-muted";

  return (
    <div
      className={cn(
        "rounded-md border border-border/70 border-l-2 bg-bg-elev px-4 py-3",
        border,
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-2xs text-fg-muted-2">
            {diff.task_id} · step {diff.step_n}
          </div>
        </div>
        <div
          className={cn(
            "text-2xs uppercase tracking-wider",
            labelColor,
          )}
        >
          {label}
        </div>
      </div>
      {(diff.kind === "regression" || diff.kind === "improvement") && (
        <ul className="mt-2 space-y-0.5 text-xs text-fg-muted">
          {diff.reasons.map((r) => (
            <li key={r} className="font-mono leading-snug">
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
