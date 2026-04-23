import { cn } from "../../lib/cn.js";

export interface SparklineProps {
  /** Values in the natural scale for the series (e.g. 0..3 for rubric scores) */
  values: number[];
  min?: number;
  max?: number;
  width?: number;
  height?: number;
  className?: string;
  /** If set, values below this render red, above render green; else all accent */
  threshold?: number;
  strokeWidth?: number;
  showDots?: boolean;
}

export function Sparkline({
  values,
  min = 0,
  max = 3,
  width = 80,
  height = 20,
  className,
  threshold,
  strokeWidth = 1.5,
  showDots = true,
}: SparklineProps) {
  if (values.length === 0) {
    return (
      <span
        className={cn(
          "inline-block h-[20px] w-[80px] text-xs text-fg-muted-2",
          className,
        )}
      >
        —
      </span>
    );
  }

  const padX = 1.5;
  const padY = 2;
  const range = max - min || 1;
  const scaleX = (width - padX * 2) / Math.max(1, values.length - 1);
  const scaleY = (height - padY * 2) / range;

  const points = values.map((v, i) => ({
    x: padX + i * scaleX,
    y: padY + (max - v) * scaleY,
    v,
  }));
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block align-middle", className)}
    >
      <path
        d={path}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-accent"
      />
      {showDots &&
        points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={1.8}
            className={cn(
              threshold === undefined
                ? "fill-accent"
                : p.v < threshold
                  ? "fill-danger"
                  : "fill-good",
            )}
          />
        ))}
    </svg>
  );
}
