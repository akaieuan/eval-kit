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
}

const RUBRIC: { value: RubricScore; label: string; tone: string }[] = [
  { value: 0, label: "0", tone: "data-[selected=true]:text-danger data-[selected=true]:border-danger/50 data-[selected=true]:bg-danger/5" },
  { value: 1, label: "1", tone: "data-[selected=true]:text-warn data-[selected=true]:border-warn/50 data-[selected=true]:bg-warn/5" },
  { value: 2, label: "2", tone: "data-[selected=true]:text-info data-[selected=true]:border-info/50 data-[selected=true]:bg-info/5" },
  { value: 3, label: "3", tone: "data-[selected=true]:text-good data-[selected=true]:border-good/50 data-[selected=true]:bg-good/5" },
];

const DESCRIPTIONS: Record<RubricScore, string> = {
  0: "0 — fail",
  1: "1 — partial",
  2: "2 — mostly",
  3: "3 — full",
};

export function ScoreSlider({
  label,
  value,
  onChange,
  disabled,
  dimension,
  compact,
}: ScoreSliderProps) {
  return (
    <div className={cn("flex items-center gap-3", compact && "py-0.5")}>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <div className="truncate text-2xs uppercase tracking-wider text-fg-muted-2">
          {label}
        </div>
        {dimension && <DimensionExplainer dimension={dimension} />}
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {RUBRIC.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            data-selected={value === opt.value}
            title={DESCRIPTIONS[opt.value]}
            className={cn(
              "h-6 w-7 rounded-md border border-border bg-bg-elev text-xs font-mono text-fg-muted-2 transition-colors hover:border-border-strong hover:text-fg",
              opt.tone,
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
