import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { MUTED } from "../../lib/type.js";

/*
 * The filter/search row.
 *
 * Inbox and Runs each reimplemented this from scratch with near-identical but
 * drifted markup — gap-2 vs gap-3, gap-1.5 vs gap-1 on labels, and input
 * strings that differed only by a stray `transition-colors`. Both hand-rolled
 * the exact className that the `Input` primitive already exports.
 */

export function Toolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      method="get"
      className={cn("flex flex-wrap items-end gap-3", className)}
    >
      {children}
    </form>
  );
}

export interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  /** Stack the control under the label (default) or inline beside it. */
  children: ReactNode;
  className?: string;
}

/**
 * Label + control pairing. The label is HUMAN VOICE — Inter, sentence case.
 * The first restyle pass swept these into wide-tracked uppercase mono, which
 * made every form read like a config file; `MUTED` is the correct role.
 */
export function Field({ label, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className={MUTED}>
        {label}
      </label>
      {children}
    </div>
  );
}
