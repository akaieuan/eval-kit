import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-normal uppercase tracking-wider border",
  {
    variants: {
      variant: {
        default: "border-border bg-transparent text-fg-muted",
        accent: "border-accent/30 bg-accent/8 text-accent",
        good: "border-good/30 bg-good/8 text-good",
        warn: "border-warn/30 bg-warn/8 text-warn",
        danger: "border-danger/30 bg-danger/8 text-danger",
        info: "border-info/30 bg-info/8 text-info",
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
