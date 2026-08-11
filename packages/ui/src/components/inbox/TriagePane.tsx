"use client";
import type { RubricScore } from "@eval-kit/core";
import { Check, ExternalLink, SkipForward } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Button } from "../primitives/button.js";
import { Kbd } from "../primitives/kbd.js";
import { BODY, DISPLAY, MICRO, MONO, MUTED } from "../../lib/type.js";
import type { InboxItemLite } from "./InboxRow.js";

const RUBRIC: { value: RubricScore; word: string; tone: string }[] = [
  { value: 0, word: "missed", tone: "data-[on=true]:border-danger/40 data-[on=true]:bg-danger/10 data-[on=true]:text-danger" },
  { value: 1, word: "partial", tone: "data-[on=true]:border-warn/40 data-[on=true]:bg-warn/10 data-[on=true]:text-warn" },
  { value: 2, word: "mostly", tone: "data-[on=true]:border-info/40 data-[on=true]:bg-info/10 data-[on=true]:text-info" },
  { value: 3, word: "full", tone: "data-[on=true]:border-good/40 data-[on=true]:bg-good/10 data-[on=true]:text-good" },
];

export interface TriagePaneProps {
  item: InboxItemLite;
  onScore: (value: RubricScore) => void;
  onAcceptPrefill?: () => void;
  onSkip?: () => void;
  onOpenFull?: () => void;
  saving?: boolean;
}

/**
 * The detail half of the triage queue: everything needed to judge ONE step.
 *
 * The rail answers "is this worth my attention next?"; this answers "what is
 * it, and what is my call?". Splitting them is what lets the rail row drop
 * from ~17 elements to four — the actions and the full signal list moved
 * here instead of being crammed into every row.
 *
 * `agent_output_preview` is rendered here for the first time. It has been
 * computed in lib/inbox.ts and carried through the whole item shape since the
 * queue was written, and no surface ever displayed it.
 */
export function TriagePane({
  item,
  onScore,
  onAcceptPrefill,
  onSkip,
  onOpenFull,
  saving,
}: TriagePaneProps) {
  const isGate = (s: string) => s.includes("gate");
  const signals = [
    ...item.signals.filter(isGate),
    ...item.signals.filter((s) => !isGate(s)),
  ];

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-6 px-[clamp(1.25rem,3vw,3rem)] py-7">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <code className={cn(MONO, "text-[11px]")}>{item.task_id}</code>
            <span className={MICRO}>step {item.step_n}</span>
            {item.is_distraction && (
              <span className="text-[11px] uppercase tracking-[0.14em] text-warn">
                distraction
              </span>
            )}
          </div>
          <h2 className={cn(DISPLAY, "text-[18px]")}>{item.task_title}</h2>
        </header>

        <section className="flex flex-col gap-2">
          <div className={MICRO}>Prompt</div>
          <p className={cn(BODY, "max-w-2xl")}>{item.step_prompt}</p>
        </section>

        {item.agent_output_preview && (
          <section className="flex flex-col gap-2">
            <div className={MICRO}>Agent output</div>
            <p className={cn(MUTED, "max-w-2xl font-mono text-[12px]")}>
              {item.agent_output_preview}
            </p>
          </section>
        )}

        {signals.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className={MICRO}>Signals</div>
            <ul className="flex flex-col gap-1.5">
              {signals.map((s) => (
                <li key={s} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      isGate(s) ? "bg-danger" : "bg-fg-muted-2",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[13px]",
                      isGate(s) ? "text-danger" : "text-fg-muted",
                    )}
                  >
                    {s}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* The action bar. Pinned to the bottom of the pane so the reviewer's
          hands and eyes land in the same place on every item — the whole
          point of a queue is that the next decision is where the last one
          was. */}
      <div className="sticky bottom-0 mt-auto border-t border-border/40 bg-bg/80 px-[clamp(1.25rem,3vw,3rem)] py-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={MICRO}>Golden truth</span>
            <div className="flex gap-1" role="radiogroup" aria-label="Golden truth">
              {RUBRIC.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={item.current_golden_truth === opt.value}
                  data-on={item.current_golden_truth === opt.value}
                  disabled={saving}
                  onClick={() => onScore(opt.value)}
                  className={cn(
                    "flex min-w-[3rem] flex-col items-center gap-0.5 rounded-md border border-border/60 px-2 py-1.5",
                    "text-fg-muted-2 transition-all hover:border-border-strong hover:bg-bg-elev-2/60 hover:text-fg",
                    "focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-40",
                    opt.tone,
                  )}
                >
                  <span className="font-mono text-[13px] leading-none tabular-nums">
                    {opt.value}
                  </span>
                  <span className="text-[9px] leading-none tracking-wide opacity-70">
                    {opt.word}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {item.status === "pre_filled" && onAcceptPrefill && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAcceptPrefill}
                disabled={saving}
              >
                <Check size={11} strokeWidth={1.5} /> Accept draft <Kbd>A</Kbd>
              </Button>
            )}
            {onSkip && (
              <Button variant="ghost" size="sm" onClick={onSkip} disabled={saving}>
                <SkipForward size={11} strokeWidth={1.5} /> Skip <Kbd>S</Kbd>
              </Button>
            )}
            {onOpenFull && (
              <Button variant="ghost" size="sm" onClick={onOpenFull}>
                <ExternalLink size={11} strokeWidth={1.5} /> Full review{" "}
                <Kbd>↵</Kbd>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
