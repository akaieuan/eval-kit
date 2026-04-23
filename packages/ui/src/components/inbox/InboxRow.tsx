"use client";
import type { RubricScore } from "@eval-kit/core";
import { Check, ChevronRight, Sparkles, SkipForward } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Kbd } from "../primitives/kbd.js";

export interface InboxItemLite {
  id: string;
  run_id: string;
  suite_id: string;
  task_id: string;
  task_title: string;
  is_distraction: boolean;
  step_n: number;
  step_prompt: string;
  agent_output_preview: string;
  status: "unscored" | "pre_filled" | "reviewed";
  signals: string[];
  priority: number;
  current_golden_truth: RubricScore | null;
}

export interface InboxRowProps {
  item: InboxItemLite;
  active?: boolean;
  onFocus?: () => void;
  onOpen?: () => void;
  onScore?: (score: RubricScore) => void;
  onAcceptPrefill?: () => void;
  onSkip?: () => void;
  saving?: boolean;
  /** If provided, wrap the whole row as a link to this URL (used for preview lists). */
  href?: string;
}

const statusStyles = {
  unscored: "border-l-warn/80",
  pre_filled: "border-l-accent/80",
  reviewed: "border-l-good/80",
} as const;

const statusLabel = {
  unscored: "Unscored",
  pre_filled: "AI draft",
  reviewed: "Reviewed",
} as const;

export function InboxRow({
  item,
  active,
  onFocus,
  onOpen,
  onScore,
  onAcceptPrefill,
  onSkip,
  saving,
  href,
}: InboxRowProps) {
  const Wrap = href ? "a" : "div";
  const wrapProps = href
    ? ({ href, className: "block" } as Record<string, unknown>)
    : {};
  return (
    <Wrap
      {...wrapProps}
      tabIndex={0}
      onFocus={onFocus}
      onClick={onFocus}
      onDoubleClick={onOpen}
      className={cn(
        "group grid grid-cols-[16px_minmax(160px,220px)_minmax(0,1fr)_auto] items-start gap-4 border-l-2 px-4 py-3 text-[13px] transition-colors",
        href ? "cursor-pointer" : "cursor-default",
        statusStyles[item.status],
        active && "bg-bg-elev-2/60",
        !active && "hover:bg-bg-elev-2/50",
      )}
    >
      <div className="flex items-center justify-center pt-0.5">
        {item.status === "unscored" && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-warn" />
        )}
        {item.status === "pre_filled" && (
          <Sparkles size={11} strokeWidth={1.5} className="text-accent" />
        )}
        {item.status === "reviewed" && (
          <Check size={11} strokeWidth={1.5} className="text-good" />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <code className="truncate font-mono text-2xs uppercase tracking-wider text-fg-muted-2">
            {item.task_id}
          </code>
          <span className="text-2xs text-fg-muted-2">·</span>
          <span className="font-mono text-2xs text-fg-muted-2">
            step {item.step_n}
          </span>
        </div>
        <div className="mt-1 truncate text-xs text-fg-muted">
          {item.task_title}
        </div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-fg-strong">{item.step_prompt}</div>
        <div className="mt-1.5 flex items-center gap-3 flex-wrap">
          <span className="text-2xs uppercase tracking-wider text-fg-muted-2">
            {statusLabel[item.status]}
          </span>
          {item.is_distraction && (
            <span className="text-2xs uppercase tracking-wider text-warn">
              distraction
            </span>
          )}
          {item.signals
            .filter((s) => s !== "distraction" && s !== "unscored")
            .slice(0, 2)
            .map((s) => (
              <span
                key={s}
                className="text-2xs uppercase tracking-wider text-fg-muted-2"
              >
                {s}
              </span>
            ))}
        </div>
      </div>

      <div className="flex items-center gap-1 justify-end">
        {active && item.status !== "reviewed" && (
          <>
            {item.status === "pre_filled" && onAcceptPrefill && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAcceptPrefill();
                }}
                disabled={saving}
                className="flex items-center gap-1 rounded-md border border-good/40 bg-good/8 px-2 py-0.5 text-2xs text-good hover:bg-good/15 disabled:opacity-50"
              >
                <Check size={10} strokeWidth={1.5} /> Accept
                <Kbd>A</Kbd>
              </button>
            )}
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onScore?.(n as RubricScore);
                }}
                disabled={saving}
                className={cn(
                  "h-6 w-6 rounded-md border text-xs font-mono transition-colors",
                  item.current_golden_truth === n
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {n}
              </button>
            ))}
            {onSkip && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip();
                }}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-fg-muted-2 hover:border-border-strong hover:text-fg"
                title="Skip (s)"
              >
                <SkipForward size={10} strokeWidth={1.5} />
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.();
          }}
          className="flex h-6 w-6 items-center justify-center rounded-md text-fg-muted-2 transition-colors hover:bg-bg-elev-2 hover:text-fg"
          title="Open full review (enter)"
        >
          <ChevronRight size={12} strokeWidth={1.5} />
        </button>
      </div>
    </Wrap>
  );
}
