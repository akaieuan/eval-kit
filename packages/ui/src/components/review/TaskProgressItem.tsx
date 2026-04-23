"use client";
import { cn } from "../../lib/cn.js";
import { Badge } from "../primitives/badge.js";
import { ProgressRing } from "../primitives/progress-ring.js";

export interface TaskProgressItemProps {
  taskId: string;
  title: string;
  stepsScored: number;
  stepsTotal: number;
  isDistraction?: boolean;
  active?: boolean;
  onClick?: () => void;
}

export function TaskProgressItem({
  taskId,
  title,
  stepsScored,
  stepsTotal,
  isDistraction,
  active,
  onClick,
}: TaskProgressItemProps) {
  const value = stepsTotal > 0 ? stepsScored / stepsTotal : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
        active
          ? "bg-bg-elev-2 text-fg-strong"
          : "text-fg-muted hover:bg-bg-elev-2/60 hover:text-fg",
      )}
    >
      <ProgressRing value={value} size={13} strokeWidth={1.5} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-2xs uppercase tracking-wider text-fg-muted-2">
            {taskId}
          </span>
          {isDistraction && (
            <Badge variant="warn" className="shrink-0">
              Distraction
            </Badge>
          )}
        </div>
        <span className="truncate text-xs leading-tight">{title}</span>
      </div>
      <span className="flex-shrink-0 font-mono text-2xs text-fg-muted-2 tabular-nums">
        {stepsScored}/{stepsTotal}
      </span>
    </button>
  );
}
