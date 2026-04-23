import { notFound } from "next/navigation";
import { hasAnthropicKey } from "@/lib/env";
import { loadRunById, loadSuiteById } from "@/lib/runs";
import { RunReview } from "./RunReview";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await loadRunById(id);
  if (!entry) notFound();

  const run = entry.run;
  const suite = await loadSuiteById(run.suite_id);
  if (!suite) {
    return (
      <div className="px-6 py-6">
        <h1 className="text-base font-medium text-fg-strong">
          Suite not found
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          This run targets <code>{run.suite_id}</code>@{run.suite_version},
          which isn&apos;t in <code>packages/seed-suite/suites</code>.
        </p>
      </div>
    );
  }

  // Strip scores off the run so the review page operates on a "blank" Run and
  // we pass existing scores via initialScores.
  const existingScored =
    entry.status === "scored"
      ? entry.run.task_results.flatMap((t) =>
          t.step_results
            .filter((s) => s.score)
            .map((s) => ({ task_id: t.task_id, score: s.score! })),
        )
      : [];

  const baseRun =
    entry.status === "scored"
      ? {
          ...entry.run,
          task_results: entry.run.task_results.map((t) => ({
            task_id: t.task_id,
            step_results: t.step_results.map(
              ({ score: _score, ...rest }) => rest,
            ),
          })),
        }
      : entry.run;

  return (
    <RunReview
      suite={suite}
      run={baseRun}
      initialScores={existingScored}
      prefillAvailable={hasAnthropicKey()}
    />
  );
}
