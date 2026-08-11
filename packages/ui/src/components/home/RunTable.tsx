import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

/**
 * The run-table column template.
 *
 * Header cells and body rows are laid out by the SAME grid string. It lived
 * inline in two dashboard routes and again in RunTableRow, so adding a column
 * meant editing three places and any miss silently knocked the headers out of
 * alignment with the data. Exported so RunTableRow consumes the identical
 * value — the alignment is now structural, not a convention.
 */
export const RUN_TABLE_COLUMNS =
  "grid-cols-[120px_1fr_180px_72px_72px_88px_120px_80px]";

const HEADINGS: { label: string; align?: "right" }[] = [
  { label: "Run" },
  { label: "Suite" },
  { label: "Adapter" },
  { label: "Tool" },
  { label: "Pass" },
  { label: "Gates" },
  { label: "Trend" },
  { label: "Started", align: "right" },
];

export interface RunTableProps {
  /** RunTableRow elements. */
  children: ReactNode;
  className?: string;
}

/** Bordered table shell + header row. Rows are passed as children. */
export function RunTable({ children, className }: RunTableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/60 bg-card",
        className,
      )}
    >
      <div
        className={cn(
          RUN_TABLE_COLUMNS,
          "grid gap-3 border-b border-border/40 bg-bg-elev-2/40 px-4 py-2.5 label",
        )}
      >
        {HEADINGS.map((h) => (
          <div key={h.label} className={h.align === "right" ? "text-right" : undefined}>
            {h.label}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
