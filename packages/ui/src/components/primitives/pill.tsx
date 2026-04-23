import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  dot?: "good" | "warn" | "danger" | "info" | "muted";
}

const dotColors = {
  good: "bg-good",
  warn: "bg-warn",
  danger: "bg-danger",
  info: "bg-info",
  muted: "bg-fg-muted-2",
};

export const Pill = forwardRef<HTMLSpanElement, PillProps>(
  ({ className, children, dot, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-bg-elev px-2 py-0.5 text-2xs font-normal text-fg-muted",
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("inline-block h-1.5 w-1.5 rounded-full", dotColors[dot])}
        />
      )}
      {children}
    </span>
  ),
);
Pill.displayName = "Pill";
