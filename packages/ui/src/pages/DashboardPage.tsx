import type { Run, ScoredRun } from "@eval-kit/core";
import { RunTableRow } from "../components/home/RunTableRow.js";
import { StatCardGroup } from "../components/home/StatCardGroup.js";
import { WelcomePanel } from "../components/home/WelcomePanel.js";
import { InlineHelp } from "../components/primitives/inline-help.js";

export interface DashboardPageProps {
  scoredRuns: ScoredRun[];
  unscoredRuns: Run[];
  unreviewedStepCount: number;
}

export function DashboardPage({
  scoredRuns,
  unscoredRuns,
  unreviewedStepCount,
}: DashboardPageProps) {
  const all: Array<{ run: Run | ScoredRun; scored: boolean }> = [
    ...scoredRuns.map((r) => ({ run: r, scored: true })),
    ...unscoredRuns.map((r) => ({ run: r, scored: false })),
  ].sort((a, b) => b.run.started_at.localeCompare(a.run.started_at));

  return (
    <div className="space-y-8 px-[clamp(1.25rem,3.5vw,3.5rem)] py-6">
      <WelcomePanel />

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[15px] font-normal tracking-tight text-fg-strong">
            Overview
          </h2>
          <span className="text-2xs uppercase tracking-wider text-fg-muted-2">
            latest scored run
          </span>
        </div>
        <StatCardGroup
          scoredRuns={scoredRuns}
          unreviewedStepCount={unreviewedStepCount}
        />
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[15px] font-normal tracking-tight text-fg-strong">
            Runs
          </h2>
          <span className="text-2xs uppercase tracking-wider text-fg-muted-2">
            {all.length} total · {unscoredRuns.length} unscored
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/80 bg-bg-elev">
          <div className="grid grid-cols-[120px_1fr_180px_72px_72px_120px_80px] gap-3 border-b border-border/80 bg-bg-elev-2/40 px-4 py-2.5 text-2xs uppercase tracking-wider text-fg-muted-2">
            <div>Run</div>
            <div>Suite</div>
            <div>Adapter</div>
            <div>Tool</div>
            <div>Pass</div>
            <div>Trend</div>
            <div className="text-right">Started</div>
          </div>
          {all.map(({ run, scored }) => (
            <RunTableRow
              key={`${run.run_id}:${scored ? "scored" : "unscored"}`}
              run={run}
              scored={scored}
              href={`/runs/${run.run_id}`}
            />
          ))}
        </div>
      </section>

      <InlineHelp id="home-next-steps" title="What's next?">
        Score unreviewed runs to populate the stat cards. Once you have two
        scored runs, the Diff page will flag regressions. New to eval-kit?{" "}
        <a href="/docs/quickstart" className="text-accent underline underline-offset-2">
          Open the quickstart →
        </a>
      </InlineHelp>
    </div>
  );
}
