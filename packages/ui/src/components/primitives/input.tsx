import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-8 w-full rounded-md border border-border bg-bg-elev px-2.5 text-[13px] text-fg placeholder:text-fg-muted-2 transition-colors focus:outline-none focus:border-fg-muted focus:bg-bg",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
