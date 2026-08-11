import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface EmptyStateProps {
  icon?: ReactNode;
  /** Brand mark slot, rendered above the title in place of `icon`. */
  mark?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  mark,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-transparent px-6 py-12 text-center",
        className,
      )}
    >
      {/* `mark` is the brand slot — the akaOSS PixelHead goes here on empty
          screens, which is where a product has room to have a voice. `icon`
          stays for callers that want a plain lucide glyph instead. */}
      {mark ? (
        <div className="mb-5">{mark}</div>
      ) : icon ? (
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg-muted">
          {icon}
        </div>
      ) : null}
      <h3 className="mb-1.5 text-[15px] font-light tracking-tight text-fg-strong">
        {title}
      </h3>
      {description && (
        <div className="max-w-md text-[13px] leading-relaxed text-fg-muted">
          {description}
        </div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
