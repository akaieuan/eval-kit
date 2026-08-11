"use client";
import type { Dimension, RubricScore } from "@eval-kit/core";
import { cn } from "../lib/cn.js";
import { DimensionExplainer } from "./review/DimensionExplainer.js";

export interface ScoreSliderProps {
  label: string;
  value: RubricScore | null;
  onChange: (next: RubricScore) => void;
  disabled?: boolean;
  dimension?: Dimension;
  compact?: boolean;
  /** Show the word under each number. On by default for the first row in a
   *  group; repeating it on every dimension is noise. */
  showLegend?: boolean;
}

/*
 * The rubric control. This is the single most-repeated action in the product —
 * a reviewer hits it once per dimension per step, thousands of times across a
 * corpus — so it gets real targets and a legible selected state rather than
 * spreadsheet cells.
 *
 * Tone runs cold-to-warm across the scale (danger → warn → info → good) and is
 * applied ONLY when selected: unselected options stay neutral so the row reads
 * as a question, not as four competing signals. Accents stay punctuation.
 */
const RUBRIC: {
  value: RubricScore;
  word: string;
  hint: string;
  tone: string;
}[] = [
  {
    value: 0,
    word: "missed",
    hint: "0 — didn't attempt, or wrong",
    tone: "data-[selected=true]:text-danger data-[selected=true]:border-danger/40 data-[selected=true]:bg-danger/10",
  },
  {
    value: 1,
    word: "partial",
    hint: "1 — partial, major gaps",
    tone: "data-[selected=true]:text-warn data-[selected=true]:border-warn/40 data-[selected=true]:bg-warn/10",
  },
  {
    value: 2,
    word: "mostly",
    hint: "2 — mostly correct, minor gaps",
    tone: "data-[selected=true]:text-info data-[selected=true]:border-info/40 data-[selected=true]:bg-info/10",
  },
  {
    value: 3,
    word: "full",
    hint: "3 — fully hit the golden truth",
    tone: "data-[selected=true]:text-good data-[selected=true]:border-good/40 data-[selected=true]:bg-good/10",
  },
];

export function ScoreSlider({
  label,
  value,
  onChange,
  disabled,
  dimension,
  compact,
  showLegend = false,
}: ScoreSliderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-2",
        compact ? "py-1" : "py-1.5",
      )}
    >
      {/* Human voice: the dimension name is Inter, sentence case. Only
          machine-generated strings get mono in this system. */}
      {/* No truncate: in the narrow review column "Collaborative performance"
          was clipping to "Collaborativ…". The row already wraps, so the label
          takes a second line rather than losing the word that identifies what
          is being scored. */}
      <div className="flex min-w-[8rem] flex-1 items-center gap-1.5">
        <span className="text-[13px] leading-snug text-fg-muted">{label}</span>
        {dimension && <DimensionExplainer dimension={dimension} />}
      </div>

      <div
        className="flex items-stretch gap-1"
        role="radiogroup"
        aria-label={label}
      >
        {RUBRIC.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            data-selected={value === opt.value}
            title={opt.hint}
            className={cn(
              "group flex min-w-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 px-2 py-1.5",
              "text-fg-muted-2 transition-all",
              "hover:border-border-strong hover:bg-bg-elev-2/60 hover:text-fg",
              "focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-40",
              opt.tone,
            )}
          >
            <span className="font-mono text-[13px] leading-none tabular-nums">
              {opt.value}
            </span>
            {showLegend && (
              <span className="text-[9px] leading-none tracking-wide opacity-70">
                {opt.word}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
