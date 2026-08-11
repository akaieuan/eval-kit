"use client";
import type { RubricScore } from "@eval-kit/core";
import { cn } from "../../lib/cn.js";
import { META, MONO } from "../../lib/type.js";

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
  /** Link form, for the home-page preview where there is no detail pane. */
  href?: string;
  className?: string;
}

/**
 * A rail row: identity, one line of content, one signal.
 *
 * This used to render between 8 and 17 elements — a status border, a status
 * glyph AND a status word (three encodings of one fact), task id, separator,
 * step number, title, prompt, up to three signal chips, and up to six action
 * buttons — at roughly equal visual weight, for every one of ~60 unpaginated
 * rows. That is why the queue was unreadable: the overwhelm was arithmetic.
 *
 * Now the row answers exactly one question — "is this worth my attention
 * next?" — and everything needed to ACT on it lives in the detail pane. Status
 * is encoded once, in the dot. Only the highest-priority signal is shown;
 * `computePriority` already ranks them, and the rest are visible on the right.
 */
export function InboxRow({
  item,
  active,
  onFocus,
  onOpen,
  href,
  className,
}: InboxRowProps) {
  const Wrap = href ? "a" : "div";
  const wrapProps = href ? ({ href } as Record<string, unknown>) : {};

  // One signal, chosen by the same ranking that orders the queue: a
  // compliance failure outranks a quality one. `+N` keeps the omission
  // visible rather than silently dropping signals, as the old row did.
  const isGate = (s: string) => s.includes("gate");
  const ranked = [
    ...item.signals.filter(isGate),
    ...item.signals.filter((s) => !isGate(s) && s !== "unscored"),
  ];
  const lead = ranked[0];
  const extra = Math.max(0, ranked.length - 1);

  const dotTone =
    item.status === "reviewed"
      ? "bg-good"
      : item.status === "pre_filled"
        ? "bg-brand"
        : "bg-warn";

  return (
    <Wrap
      {...wrapProps}
      tabIndex={0}
      onFocus={onFocus}
      onClick={onFocus}
      onDoubleClick={onOpen}
      className={cn(
        "group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
        href ? "cursor-pointer" : "cursor-default",
        active
          ? "bg-bg-elev-2/70"
          : "hover:bg-bg-elev-2/40",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dotTone)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <code className={cn(MONO, "truncate text-[11px]")}>
            {item.task_id}
          </code>
          <span className={cn(META, "shrink-0")}>step {item.step_n}</span>
        </div>
        <p
          className={cn(
            "mt-1 line-clamp-2 text-[13px] leading-snug",
            active ? "text-fg-strong" : "text-fg",
          )}
        >
          {item.step_prompt}
        </p>
        {lead && (
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={cn(
                "text-[11px] uppercase tracking-[0.14em]",
                isGate(lead) ? "text-danger" : "text-fg-muted-2",
              )}
            >
              {lead}
            </span>
            {extra > 0 && (
              <span className={META} title={ranked.slice(1).join(" · ")}>
                +{extra}
              </span>
            )}
          </div>
        )}
      </div>
    </Wrap>
  );
}
