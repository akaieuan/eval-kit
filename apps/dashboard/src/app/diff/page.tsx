import Link from "next/link";
import { EmptyState, DiffPage, Button } from "@eval-kit/ui";
import { GitCompare } from "lucide-react";
import { loadScoredRuns } from "@/lib/runs";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  const runs = await loadScoredRuns();

  if (runs.length < 2) {
    return (
      <div className="px-[clamp(1.25rem,3.5vw,3.5rem)] py-8">
        <EmptyState
          icon={<GitCompare size={16} strokeWidth={1.5} />}
          title="Need two scored runs"
          description={
            <p>
              Diff compares two <em>scored</em> runs. You currently have{" "}
              {runs.length}. Score at least two runs from the Overview, then
              come back.
            </p>
          }
          action={
            <Button asChild variant="primary">
              <Link href="/">Back to overview</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const sorted = [...runs].sort((x, y) =>
    y.started_at.localeCompare(x.started_at),
  );
  const runA = runs.find((r) => r.run_id === a) ?? sorted[1];
  const runB = runs.find((r) => r.run_id === b) ?? sorted[0];

  return (
    <div className="flex flex-col">
      <form
        method="get"
        className="flex items-end gap-3 border-b border-border/70 bg-bg-elev/40 px-[clamp(1.25rem,3.5vw,3.5rem)] py-4"
      >
        <div>
          <div className="mb-1.5 text-2xs uppercase tracking-wider text-fg-muted-2">
            A (baseline)
          </div>
          <select
            name="a"
            defaultValue={runA?.run_id}
            className="h-8 min-w-[260px] rounded-md border border-border bg-bg-elev px-2 text-[13px] text-fg transition-colors hover:border-border-strong focus:outline-none focus:border-fg-muted"
          >
            {runs.map((r) => (
              <option key={r.run_id} value={r.run_id}>
                {r.run_id.slice(0, 8)} — {r.adapter.name}/{r.adapter.model}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="mb-1.5 text-2xs uppercase tracking-wider text-fg-muted-2">
            B (new)
          </div>
          <select
            name="b"
            defaultValue={runB?.run_id}
            className="h-8 min-w-[260px] rounded-md border border-border bg-bg-elev px-2 text-[13px] text-fg transition-colors hover:border-border-strong focus:outline-none focus:border-fg-muted"
          >
            {runs.map((r) => (
              <option key={r.run_id} value={r.run_id}>
                {r.run_id.slice(0, 8)} — {r.adapter.name}/{r.adapter.model}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="primary">
          Compare
        </Button>
      </form>

      {runA && runB && runA.run_id !== runB.run_id ? (
        <DiffPage a={runA} b={runB} />
      ) : (
        <div className="px-[clamp(1.25rem,3.5vw,3.5rem)] py-8">
          <EmptyState title="Pick two different runs" />
        </div>
      )}
    </div>
  );
}
