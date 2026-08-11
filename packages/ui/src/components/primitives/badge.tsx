import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-2xs font-normal uppercase tracking-[0.14em] border",
  {
    variants: {
      variant: {
        default: "border-border bg-transparent text-fg-muted",
        accent: "border-accent/40 bg-accent/10 text-accent",
        good: "border-good/40 bg-good/10 text-good",
        warn: "border-warn/40 bg-warn/10 text-warn",
        danger: "border-danger/40 bg-danger/10 text-danger",
        info: "border-info/40 bg-info/10 text-info",
        outline: "border-border text-fg-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";

export { badgeVariants };
