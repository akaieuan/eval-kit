import { RunTableRow, InlineHelp } from "@eval-kit/ui";
import { listRuns } from "@/lib/runs";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ adapter?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const all = await listRuns();

  const adapterOptions = Array.from(
    new Set(all.map((e) => e.run.adapter.name)),
  );

  const filtered = all.filter((entry) => {
    if (params.adapter && entry.run.adapter.name !== params.adapter) {
      return false;
    }
    if (params.status === "scored" && entry.status !== "scored") return false;
    if (params.status === "unscored" && entry.status !== "unscored") {
      return false;
    }
    if (params.q) {
      const q = params.q.toLowerCase();
      const hay =
        `${entry.run.run_id} ${entry.run.suite_id} ${entry.run.adapter.name} ${entry.run.adapter.model}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5 px-[clamp(1.25rem,3.5vw,3.5rem)] py-6">
      <div>
        <h1 className="text-[18px] font-light tracking-tight text-fg-strong">
          All runs
        </h1>
        <p className="mt-1 text-xs text-fg-muted">
          Every <code>runs/*.json</code> artifact on disk.
        </p>
      </div>

      <InlineHelp id="runs-primer" title="Two states: scored and unscored">
        Runs land in <code>runs/</code> when you invoke{" "}
        <code>eval-kit run</code>. Click a run to score it step-by-step. Once
        saved, a <code>.scored.json</code> file lives alongside the original.
      </InlineHelp>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="q"
            className="text-2xs uppercase tracking-wider text-fg-muted-2"
          >
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="run id, suite, model…"
            className="h-8 w-64 rounded-md border border-border bg-bg-elev px-2.5 text-[13px] text-fg placeholder:text-fg-muted-2 focus:outline-none focus:border-fg-muted focus:bg-bg"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="adapter"
            className="text-2xs uppercase tracking-wider text-fg-muted-2"
          >
            Adapter
          </label>
          <select
            id="adapter"
            name="adapter"
            defaultValue={params.adapter ?? ""}
            className="h-8 rounded-md border border-border bg-bg-elev px-2 text-[13px] text-fg"
          >
            <option value="">all</option>
            {adapterOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="status"
            className="text-2xs uppercase tracking-wider text-fg-muted-2"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={params.status ?? ""}
            className="h-8 rounded-md border border-border bg-bg-elev px-2 text-[13px] text-fg"
          >
            <option value="">all</option>
            <option value="scored">scored</option>
            <option value="unscored">unscored</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-8 rounded-md border border-border bg-bg-elev px-3 text-[13px] text-fg hover:border-border-strong"
        >
          Apply
        </button>
      </form>

      {filtered.length === 0 ? (
        <p className="text-xs text-fg-muted">No runs match.</p>
      ) : (
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
          {filtered.map((entry) => (
            <RunTableRow
              key={entry.file}
              run={entry.run}
              scored={entry.status === "scored"}
              href={`/runs/${entry.run.run_id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
