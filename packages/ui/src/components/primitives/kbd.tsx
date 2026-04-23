import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

export const Kbd = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  ({ className, children, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-bg-elev px-1 font-mono text-[10px] leading-none text-fg-muted-2",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  ),
);
Kbd.displayName = "Kbd";
