import {
  Button,
  Field,
  Input,
  PageHeader,
  Toolbar,
  type InboxItemLite,
} from "@eval-kit/ui";
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
    /* No `Page` wrapper here: the triage view is a full-height SplitPane and
       must not sit inside the page's vertical padding, or the rail scrolls
       with the document instead of independently. Header and toolbar carry
       their own gutter. */
    <div className="flex h-[calc(100dvh-44px)] flex-col">
      <div className="flex flex-col gap-5 px-[clamp(1.25rem,3.5vw,3.5rem)] pb-5 pt-7">
        <PageHeader
          title="Inbox"
          description="Everything awaiting your review, highest-priority first."
        />
        <Toolbar>
          <Field label="Search" htmlFor="q">
            <Input
              id="q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="prompt, output, task id…"
              className="w-64"
            />
          </Field>
          <Field label="Status" htmlFor="status">
            <select
              id="status"
              name="status"
              defaultValue={params.status ?? ""}
              className="h-8 rounded-md border border-border bg-bg-elev px-2 text-[13px] text-fg transition-colors hover:border-border-strong focus:border-fg-muted focus:outline-none"
            >
              <option value="">all</option>
              <option value="unscored">unscored</option>
              <option value="pre_filled">AI draft</option>
              <option value="reviewed">reviewed</option>
            </select>
          </Field>
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </Toolbar>
      </div>

      <div className="min-h-0 flex-1 border-t border-border/40">
        <InboxClient items={items.map(toLite)} />
      </div>
    </div>
  );
}
