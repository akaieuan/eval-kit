"use client";
import type { RubricScore } from "@eval-kit/core";
import {
  InboxView,
  recordScoreInSession,
  type InboxItemLite,
} from "@eval-kit/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { scoreStepInline } from "./actions";

export interface InboxClientProps {
  items: Array<InboxItemLite & { run_id: string; step_n: number }>;
}

export function InboxClient({ items: initial }: InboxClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => items, [items]);

  async function handle(
    item: InboxItemLite & { run_id: string; step_n: number },
    action:
      | { kind: "golden_truth"; value: RubricScore }
      | { kind: "accept_prefill" }
      | { kind: "skip" },
  ) {
    if (action.kind === "skip") return; // handled locally in InboxView
    const payload =
      action.kind === "golden_truth"
        ? { golden_truth: action.value as RubricScore }
        : { accept: true };

    startTransition(async () => {
      const res = await scoreStepInline({
        run_id: item.run_id,
        task_id: item.task_id,
        step_n: item.step_n,
        ...payload,
      });
      if (!res.ok) {
        toast.error("Save failed", { description: res.error });
        return;
      }
      recordScoreInSession();
      toast.success(
        action.kind === "accept_prefill"
          ? "Accepted AI draft"
          : `Scored ${action.value}`,
      );

      // local optimistic update so the row flips to reviewed without a refetch
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                status: "reviewed",
                current_golden_truth:
                  action.kind === "golden_truth"
                    ? action.value
                    : it.current_golden_truth,
              }
            : it,
        ),
      );
      router.refresh();
    });
  }

  function openFull(item: InboxItemLite & { run_id: string; step_n: number }) {
    router.push(`/runs/${item.run_id}#step-${item.step_n}`);
  }

  return (
    <InboxView
      items={visible}
      onScoreStep={handle}
      onOpenFull={openFull}
      saving={pending}
    />
  );
}
