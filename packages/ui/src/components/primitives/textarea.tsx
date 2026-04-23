import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md border border-border bg-bg-elev p-2.5 text-[13px] leading-relaxed text-fg placeholder:text-fg-muted-2 transition-colors focus:outline-none focus:border-fg-muted focus:bg-bg resize-y",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
