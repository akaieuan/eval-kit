import { cn } from "../../lib/cn.js";

export interface ProgressRingProps {
  value: number; // 0..1
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
  /** Whether to render a tiny numeric label in the center */
  showLabel?: boolean;
}

export function ProgressRing({
  value,
  size = 16,
  strokeWidth = 2,
  className,
  label,
  showLabel = false,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * clamped;
  const track = circumference - dash;

  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      role="img"
      aria-label={label ?? `${Math.round(clamped * 100)}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${track}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="stroke-fg-strong transition-[stroke-dasharray] duration-300"
        />
      </svg>
      {showLabel && (
        <span className="absolute text-2xs text-fg-muted">
          {Math.round(clamped * 100)}
        </span>
      )}
    </span>
  );
}
