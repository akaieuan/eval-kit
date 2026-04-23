import type { InboxItemLite } from "@eval-kit/ui";
import { listInboxItems } from "@/lib/inbox";
import { InboxClient } from "./InboxClient";

function toLite(i: Awaited<ReturnType<typeof listInboxItems>>[number]): InboxItemLite & {
  run_id: string;
  step_n: number;
} {
  return {
    id: i.id,
    run_id: i.run_id,
    suite_id: i.suite_id,
    task_id: i.task_id,
    task_title: i.task_title,
    is_distraction: i.is_distraction,
    step_n: i.step_n,
    step_prompt: i.step_prompt,
    agent_output_preview: i.agent_output_preview,
    status: i.status,
    signals: i.signals,
    priority: i.priority,
    current_golden_truth: i.score?.golden_truth ?? null,
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; run?: string; status?: string }>;
}) {
  const params = await searchParams;
  const items = await listInboxItems({
    search: params.q,
    runId: params.run,
    status:
      params.status === "unscored" ||
      params.status === "pre_filled" ||
      params.status === "reviewed"
        ? params.status
        : undefined,
  });

  return (
    <div className="space-y-5 px-[clamp(1.25rem,3.5vw,3.5rem)] py-6">
      <div>
        <h1 className="text-[18px] font-light tracking-tight text-fg-strong">
          Inbox
        </h1>
        <p className="mt-1 text-xs text-fg-muted">
          Everything awaiting your review, prioritized.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
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
            placeholder="prompt, output, task id…"
            className="h-8 w-64 rounded-md border border-border bg-bg-elev px-2.5 text-[13px] text-fg placeholder:text-fg-muted-2 transition-colors focus:outline-none focus:border-fg-muted focus:bg-bg"
          />
        </div>
        <div className="flex flex-col gap-1.5">
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
            className="h-8 rounded-md border border-border bg-bg-elev px-2 text-[13px] text-fg transition-colors hover:border-border-strong focus:outline-none focus:border-fg-muted"
          >
            <option value="">all</option>
            <option value="unscored">unscored</option>
            <option value="pre_filled">AI draft</option>
            <option value="reviewed">reviewed</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-8 rounded-md border border-border bg-bg-elev px-3 text-[13px] text-fg transition-colors hover:border-border-strong hover:bg-bg-elev-2"
        >
          Apply
        </button>
      </form>

      <InboxClient items={items.map(toLite)} />
    </div>
  );
}
