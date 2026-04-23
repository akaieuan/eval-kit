import type { ScoredRun } from "@eval-kit/core";
import { diffRuns } from "@eval-kit/core";
import { DiffRow } from "../components/diff/DiffRow.js";
import { RegressionSummary } from "../components/diff/RegressionSummary.js";
import { InlineHelp } from "../components/primitives/inline-help.js";

export interface DiffPageProps {
  a: ScoredRun;
  b: ScoredRun;
}

export function DiffPage({ a, b }: DiffPageProps) {
  const diffs = diffRuns(a, b);

  const byTask = new Map<string, typeof diffs>();
  for (const d of diffs) {
    const existing = byTask.get(d.task_id) ?? [];
    existing.push(d);
    byTask.set(d.task_id, existing);
  }

  return (
    <div className="space-y-6 px-[clamp(1.25rem,3.5vw,3.5rem)] py-6">
      <InlineHelp id="diff-primer" title="What counts as a regression?">
        A step is a regression when <code>tool_match</code> got worse,{" "}
        <code>golden_truth</code> dropped, a distraction that used to be caught
        is now missed, or any human-scored dimension dropped from the prior run.
      </InlineHelp>

      <div className="grid gap-3 md:grid-cols-2">
        <RunSummary label="Run A" run={a} />
        <RunSummary label="Run B" run={b} />
      </div>

      <RegressionSummary diffs={diffs} />

      <div className="space-y-6">
        {[...byTask.entries()].map(([taskId, list]) => {
          const changed = list.filter((d) => d.kind !== "unchanged");
          if (changed.length === 0) return null;
          return (
            <section key={taskId}>
              <h3 className="mb-3 flex items-center gap-2 font-mono text-2xs uppercase tracking-wider text-fg-muted-2">
                <span>{taskId}</span>
                <span className="text-fg-muted-2">
                  · {changed.length} change{changed.length === 1 ? "" : "s"}
                </span>
              </h3>
              <div className="space-y-2">
                {changed.map((d) => (
                  <DiffRow
                    key={`${d.task_id}::${d.step_n}-${d.kind}`}
                    diff={d}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RunSummary({
  label,
  run,
}: {
  label: string;
  run: ScoredRun;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-bg-elev px-5 py-4 text-xs">
      <div className="text-2xs uppercase tracking-wider text-fg-muted-2">
        {label}
      </div>
      <div className="mt-2">
        <code className="font-mono text-[13px] text-fg-strong">
          {run.run_id.slice(0, 8)}
        </code>
      </div>
      <div className="mt-1 text-fg-muted">
        {run.adapter.name}
        <span className="text-fg-muted-2">/{run.adapter.model}</span>
      </div>
      <div className="mt-0.5 text-fg-muted-2">
        {new Date(run.started_at).toLocaleString()}
      </div>
    </div>
  );
}
