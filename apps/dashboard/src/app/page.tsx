import Link from "next/link";
import {
  EmptyState,
  InboxRow,
  InlineHelp,
  RunTableRow,
  StatCardGroup,
  WelcomePanel,
} from "@eval-kit/ui";
import { Inbox as InboxIcon, Rocket } from "lucide-react";
import { listInboxItems } from "@/lib/inbox";
import {
  listRuns,
  loadScoredRuns,
  loadUnscoredRuns,
  unreviewedStepCount,
} from "@/lib/runs";

export default async function Page() {
  const [scoredRuns, unscoredRuns, unreviewed, all, inbox] = await Promise.all([
    loadScoredRuns(),
    loadUnscoredRuns(),
    unreviewedStepCount(),
    listRuns(),
    listInboxItems(),
  ]);

  if (all.length === 0) {
    return (
      <div className="px-8 py-10">
        <EmptyState
          icon={<Rocket size={16} strokeWidth={1.5} />}
          title="No runs yet"
          description={
            <div className="space-y-3">
              <p>
                Generate a mock run to try the scoring flow. From the repo
                root:
              </p>
              <pre className="mx-auto max-w-lg whitespace-pre-wrap rounded-md border border-border/70 bg-bg-elev px-3 py-2.5 text-left font-mono text-xs text-fg-muted">
                {`node packages/core/dist/cli.js run \\
  packages/seed-suite/suites/research-agent-v1.yaml \\
  --adapter mock --out runs/demo.json`}
              </pre>
              <p>
                Or read the{" "}
                <a href="/docs/quickstart" className="text-accent underline underline-offset-2">
                  quickstart
                </a>{" "}
                for the full adapter walkthrough.
              </p>
            </div>
          }
        />
      </div>
    );
  }

  // Top 5 unreviewed items for the preview; sorted by priority via listInboxItems.
  const priorityPreview = inbox
    .filter((i) => i.status !== "reviewed")
    .slice(0, 5);

  const sortedRuns: Array<{ run: (typeof all)[number]["run"]; scored: boolean; file: string }> =
    all.map((entry) => ({
      run: entry.run,
      scored: entry.status === "scored",
      file: entry.file,
    }));

  return (
    <div className="space-y-8 px-[clamp(1.25rem,3.5vw,3.5rem)] py-6">
      <WelcomePanel />

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-normal tracking-tight text-fg-strong">
              Inbox
            </h2>
            <span className="text-2xs uppercase tracking-wider text-fg-muted-2">
              {priorityPreview.length} of {inbox.filter((i) => i.status !== "reviewed").length} pending
            </span>
          </div>
          <Link
            href="/inbox"
            className="text-xs text-fg-muted hover:text-fg"
          >
            See all →
          </Link>
        </div>

        {priorityPreview.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border/80 bg-bg-elev divide-y divide-border/60">
            {priorityPreview.map((item) => (
              <div key={item.id} data-inbox-id={item.id}>
                <InboxRow
                  href={`/runs/${item.run_id}#step-${item.step_n}`}
                  item={{
                    id: item.id,
                    run_id: item.run_id,
                    suite_id: item.suite_id,
                    task_id: item.task_id,
                    task_title: item.task_title,
                    is_distraction: item.is_distraction,
                    step_n: item.step_n,
                    step_prompt: item.step_prompt,
                    agent_output_preview: item.agent_output_preview,
                    status: item.status,
                    signals: item.signals,
                    priority: item.priority,
                    current_golden_truth:
                      item.score?.golden_truth ?? null,
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border/80 bg-bg-elev px-5 py-10 text-center">
            <InboxIcon
              size={18}
              strokeWidth={1.5}
              className="mx-auto text-fg-muted-2"
            />
            <p className="mt-2 text-xs text-fg-muted">
              Inbox zero. No steps are waiting on a human.
            </p>
          </div>
        )}
      </section>

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
          unreviewedStepCount={unreviewed}
        />
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[15px] font-normal tracking-tight text-fg-strong">
            Runs
          </h2>
          <span className="text-2xs uppercase tracking-wider text-fg-muted-2">
            {sortedRuns.length} total · {unscoredRuns.length} unscored
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
          {sortedRuns.map(({ run, scored, file }) => (
            <RunTableRow
              key={file}
              run={run}
              scored={scored}
              href={`/runs/${run.run_id}`}
            />
          ))}
        </div>
      </section>

      <InlineHelp id="home-next-steps" title="What's next?">
        The Inbox surfaces work that needs your attention — start there. The
        Diff page flags regressions once you have two scored runs. New to
        eval-kit?{" "}
        <Link href="/docs/quickstart" className="text-accent underline underline-offset-2">
          Open the quickstart →
        </Link>
      </InlineHelp>
    </div>
  );
}
