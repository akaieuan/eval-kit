"use client";
import type { RubricScore } from "@eval-kit/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn.js";
import { EmptyState } from "../primitives/empty-state.js";
import { SplitPane } from "../layout/SplitPane.js";
import { MICRO } from "../../lib/type.js";
import { InboxRow, type InboxItemLite } from "./InboxRow.js";
import { TriagePane } from "./TriagePane.js";

export interface InboxViewProps {
  items: InboxItemLite[];
  onScoreStep: (
    item: InboxItemLite,
    action:
      | { kind: "golden_truth"; value: RubricScore }
      | { kind: "accept_prefill" }
      | { kind: "skip" },
  ) => Promise<void> | void;
  onOpenFull: (item: InboxItemLite) => void;
  saving?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function InboxView({
  items,
  onScoreStep,
  onOpenFull,
  saving,
  emptyTitle = "Inbox zero",
  emptyDescription = "Every step has been reviewed. New runs show up here automatically.",
}: InboxViewProps) {
  const [activeId, setActiveId] = useState<string | null>(
    items.find((i) => i.status !== "reviewed")?.id ?? items[0]?.id ?? null,
  );
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const visible = items.filter((i) => !hiddenIds.has(i.id));
  const activeIdx = visible.findIndex((i) => i.id === activeId);
  const active = activeIdx >= 0 ? visible[activeIdx]! : null;

  const move = useCallback(
    (delta: number) => {
      if (visible.length === 0) return;
      const next = Math.max(0, Math.min(visible.length - 1, activeIdx + delta));
      setActiveId(visible[next]!.id);
    },
    [visible, activeIdx],
  );

  const scoreActive = useCallback(
    async (action: Parameters<typeof onScoreStep>[1]) => {
      if (!active) return;
      await onScoreStep(active, action);
      // auto-advance to next unreviewed
      if (action.kind !== "skip") {
        const nextIdx = visible.findIndex(
          (i, idx) => idx > activeIdx && i.status !== "reviewed",
        );
        if (nextIdx >= 0) setActiveId(visible[nextIdx]!.id);
        else move(1);
      } else {
        // skip = temporary hide
        setHiddenIds((prev) => new Set(prev).add(active.id));
        move(1);
      }
    },
    [active, onScoreStep, visible, activeIdx, move],
  );

  // keyboard bindings
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
        return;
      }
      if (!active) return;

      if (e.key === "Enter" || e.key === "o") {
        e.preventDefault();
        onOpenFull(active);
        return;
      }
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        e.preventDefault();
        void scoreActive({
          kind: "golden_truth",
          value: Number(e.key) as RubricScore,
        });
        return;
      }
      if (e.key === "a" && active.status === "pre_filled") {
        e.preventDefault();
        void scoreActive({ kind: "accept_prefill" });
        return;
      }
      if (e.key === "s") {
        e.preventDefault();
        void scoreActive({ kind: "skip" });
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, move, scoreActive, onOpenFull]);

  // scroll active row into view
  useEffect(() => {
    if (!activeId || !containerRef.current) return;
    const row = containerRef.current.querySelector<HTMLDivElement>(
      `[data-inbox-id="${CSS.escape(activeId)}"]`,
    );
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  if (items.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    );
  }

  const unscoredCount = items.filter((i) => i.status === "unscored").length;
  const prefilledCount = items.filter((i) => i.status === "pre_filled").length;
  const doneCount = items.length - unscoredCount - prefilledCount;

  return (
    <SplitPane
      rail={
        <div ref={containerRef} className="flex flex-col">
          {/* Counts live above the rail, not as a separate page band: they
              describe the list they sit on top of. */}
          <div className="sticky top-0 z-10 flex items-baseline gap-4 border-b border-border/40 bg-bg/80 px-4 py-3 backdrop-blur-md">
            <span className={cn(MICRO, "tabular-nums")}>
              {unscoredCount} <span className="text-warn">unscored</span>
            </span>
            <span className={cn(MICRO, "tabular-nums")}>
              {prefilledCount} <span className="text-brand">drafts</span>
            </span>
            <span className={cn(MICRO, "tabular-nums")}>
              {doneCount} <span className="text-good">done</span>
            </span>
          </div>
          <div className="divide-y divide-border/40">
            {visible.map((item) => (
              <div key={item.id} data-inbox-id={item.id}>
                <InboxRow
                  item={item}
                  active={item.id === activeId}
                  onFocus={() => setActiveId(item.id)}
                  onOpen={() => onOpenFull(item)}
                />
              </div>
            ))}
          </div>
        </div>
      }
    >
      {active ? (
        <TriagePane
          item={active}
          saving={saving}
          onScore={(v) => void scoreActive({ kind: "golden_truth", value: v })}
          onAcceptPrefill={
            active.status === "pre_filled"
              ? () => void scoreActive({ kind: "accept_prefill" })
              : undefined
          }
          onSkip={() => void scoreActive({ kind: "skip" })}
          onOpenFull={() => onOpenFull(active)}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-10">
          <EmptyState
            title="Nothing selected"
            description="Pick an item from the queue, or press J to start at the top."
          />
        </div>
      )}
    </SplitPane>
  );
}
