import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
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
      {icon && (
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg-muted-2">
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-[13px] font-normal tracking-tight text-fg-strong">
        {title}
      </h3>
      {description && (
        <div className="max-w-md text-xs text-fg-muted leading-relaxed">
          {description}
        </div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
