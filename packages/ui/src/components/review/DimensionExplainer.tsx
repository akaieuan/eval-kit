"use client";
import type { Dimension } from "@eval-kit/core";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../primitives/popover.js";
import {
  DIMENSION_DESCRIPTIONS,
  DIMENSION_LABELS,
  DIMENSION_RUBRIC_EXAMPLES,
} from "./dimension-copy.js";

export interface DimensionExplainerProps {
  dimension: Dimension;
}

export function DimensionExplainer({ dimension }: DimensionExplainerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Explain ${DIMENSION_LABELS[dimension]}`}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-fg-muted-2 hover:text-accent"
        >
          <Info size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80">
        <div className="text-sm font-medium text-fg-strong">
          {DIMENSION_LABELS[dimension]}
        </div>
        <p className="mt-1 text-xs text-fg-muted leading-relaxed">
          {DIMENSION_DESCRIPTIONS[dimension]}
        </p>
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          {([0, 1, 2, 3] as const).map((score) => (
            <div key={score} className="flex gap-2 text-xs">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-bg-elev font-mono text-2xs text-fg-muted">
                {score}
              </span>
              <span className="text-fg-muted leading-relaxed">
                {DIMENSION_RUBRIC_EXAMPLES[dimension][score]}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
