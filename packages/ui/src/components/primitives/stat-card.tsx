import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { Sparkline } from "./sparkline.js";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  delta?: { value: number; suffix?: string };
  sparkline?: number[];
  sparklineMax?: number;
  className?: string;
}

export function StatCard({
  label,
  value,
  sublabel,
  delta,
  sparkline,
  sparklineMax = 1,
  className,
}: StatCardProps) {
  const deltaSign = delta ? Math.sign(delta.value) : 0;
  const DeltaIcon = deltaSign > 0 ? ArrowUp : deltaSign < 0 ? ArrowDown : Minus;
  const deltaColor =
    deltaSign > 0
      ? "text-good"
      : deltaSign < 0
        ? "text-danger"
        : "text-fg-muted-2";

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-lg border border-border/80 bg-bg-elev px-5 py-4 min-h-[112px]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-2xs uppercase tracking-wider text-fg-muted-2">
          {label}
        </div>
        {sparkline && (
          <Sparkline
            values={sparkline}
            max={sparklineMax}
            width={72}
            height={22}
            showDots={false}
          />
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <div className="text-[26px] font-light leading-none tracking-tight text-fg-strong tabular-nums">
          {value}
        </div>
        {delta && (
          <div className={cn("flex items-center gap-0.5 text-2xs", deltaColor)}>
            <DeltaIcon size={10} strokeWidth={1.5} />
            <span className="tabular-nums">
              {delta.value > 0 ? "+" : ""}
              {delta.value}
              {delta.suffix}
            </span>
          </div>
        )}
      </div>
      {sublabel && (
        <div className="mt-1.5 text-xs text-fg-muted-2">{sublabel}</div>
      )}
    </div>
  );
}
