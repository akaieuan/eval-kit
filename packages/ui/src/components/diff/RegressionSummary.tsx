import type { StepDiff } from "@eval-kit/core";
import { cn } from "../../lib/cn.js";

export interface RegressionSummaryProps {
  diffs: StepDiff[];
  className?: string;
}

export function RegressionSummary({ diffs, className }: RegressionSummaryProps) {
  const regressions = diffs.filter((d) => d.kind === "regression");
  const improvements = diffs.filter((d) => d.kind === "improvement");
  const unchanged = diffs.filter((d) => d.kind === "unchanged").length;
  const onlyA = diffs.filter((d) => d.kind === "only_in_a").length;
  const onlyB = diffs.filter((d) => d.kind === "only_in_b").length;

  const worst = regressions
    .map((r) => {
      if (r.kind !== "regression") return null;
      const aGt = r.a.score?.golden_truth ?? null;
      const bGt = r.b.score?.golden_truth ?? null;
      const drop =
        typeof aGt === "number" && typeof bGt === "number"
          ? aGt - bGt
          : r.reasons.some((s) => s.startsWith("tool_match"))
            ? 1
            : 0;
      return { ...r, drop };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 5);

  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 bg-bg-elev px-6 py-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-8">
        <Stat label="Regressions" value={regressions.length} tone="danger" />
        <Stat label="Improvements" value={improvements.length} tone="good" />
        <Stat label="Unchanged" value={unchanged} tone="muted" />
        {onlyA > 0 && <Stat label="Only in A" value={onlyA} tone="muted" />}
        {onlyB > 0 && <Stat label="Only in B" value={onlyB} tone="muted" />}
      </div>

      {worst.length > 0 && (
        <div className="mt-6 border-t border-border/60 pt-5">
          <div className="mb-3 text-2xs uppercase tracking-wider text-fg-muted-2">
            Worst regressions
          </div>
          <ul className="space-y-1.5">
            {worst.map((r) => (
              <li
                key={`${r.task_id}::${r.step_n}`}
                className="flex items-center gap-3 text-[13px]"
              >
                <span className="w-24 truncate font-mono text-2xs text-fg-muted-2">
                  {r.task_id}
                </span>
                <span className="text-fg-muted">step {r.step_n}</span>
                <span className="flex-1 truncate text-fg-muted">
                  {r.reasons.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "good" | "muted";
}) {
  const color =
    tone === "danger"
      ? "text-danger"
      : tone === "good"
        ? "text-good"
        : "text-fg";
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-fg-muted-2">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-[26px] font-light leading-none tracking-tight tabular-nums",
          color,
        )}
      >
        {value}
      </div>
    </div>
  );
}
