import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { DISPLAY, HEADING, MICRO, MUTED } from "../../lib/type.js";

/*
 * Page chrome primitives.
 *
 * Before these existed, every route hand-rolled its own: nine routes wrote
 * their own <h1>, eight of them repeating the identical class string, and the
 * page gutter had drifted into SEVEN distinct values across the app
 * (px-[clamp(1.25rem,3.5vw,3.5rem)], px-8, px-6, py-8, two other clamp
 * families…). Vertical rhythm was per-route too — space-y-5 here, -8 there,
 * -3 and -4 inside shared components.
 *
 * One gutter, one rhythm, one title treatment, defined once.
 */

/** The page gutter + vertical rhythm. Wraps every route's content. */
export function Page({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-[clamp(1.25rem,3.5vw,3.5rem)] py-7 pb-16",
        "flex flex-col gap-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  /** One line under the title. Human voice — keep it a sentence. */
  description?: ReactNode;
  /** Micro-eyebrow above the title (mono). Use for counts/context, not prose. */
  eyebrow?: ReactNode;
  /** Right-aligned controls: buttons, toggles. */
  actions?: ReactNode;
  className?: string;
}

/** Title block. Every route gets exactly one. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-wrap items-end justify-between gap-4", className)}
    >
      <div className="min-w-0">
        {eyebrow && <div className={cn(MICRO, "mb-2")}>{eyebrow}</div>}
        <h1 className={DISPLAY}>{title}</h1>
        {description && (
          <p className={cn(MUTED, "mt-1.5 max-w-2xl")}>{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

export interface SectionProps {
  title?: ReactNode;
  /** Right-aligned micro-meta on the heading row — counts, status. */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A titled block within a page. Heading left, meta right — the akaOSS section
 * header row, which pairs a light heading with a mono micro-label.
 */
export function Section({ title, meta, children, className }: SectionProps) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      {(title || meta) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          {title ? <h2 className={HEADING}>{title}</h2> : <span />}
          {meta && <span className={MICRO}>{meta}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
