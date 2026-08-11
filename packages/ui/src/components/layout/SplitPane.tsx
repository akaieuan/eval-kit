"use client";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

/**
 * The AppShell header height, in pixels.
 *
 * It was hard-coded as `h-11` in AppShell, `top-11` in RunReviewPage and
 * docs/layout, and `calc(100dvh - 44px)` in two more places — the same number
 * spelled three different ways across four files, with nothing keeping them in
 * step. Exported so a change to the header can't silently break every sticky
 * region in the app.
 */
export const SHELL_HEADER_PX = 44;

export interface SplitPaneProps {
  /** The scannable list. Scrolls independently. */
  rail: ReactNode;
  /** The focused item. Scrolls independently. */
  children: ReactNode;
  /** Rail width. Defaults to the review-rail clamp. */
  railWidth?: string;
  className?: string;
}

/**
 * List-plus-detail layout: a fixed-width rail beside a fluid detail pane, each
 * with its OWN scroll region and neither scrolling the page.
 *
 * Why this matters beyond tidiness: the run-detail route previously nested a
 * scrolling <section> inside AppShell's scrolling <main> inside a scrolling
 * <aside> — three overlapping scroll containers, so the wheel target depended
 * on cursor position and the rail could scroll away from the content it
 * indexes. Here the pane owns exactly one scroll region per side.
 */
export function SplitPane({
  rail,
  children,
  railWidth = "clamp(230px,19vw,300px)",
  className,
}: SplitPaneProps) {
  // Fill the parent rather than assuming a position under the shell header.
  // Hardcoding calc(100dvh - 44px) here overflowed by the height of whatever
  // sat above it — on the inbox that was the page header and toolbar, which
  // pushed the triage action bar off the bottom of the screen.
  return (
    <div
      className={cn("grid h-full min-h-0", className)}
      style={{ gridTemplateColumns: `${railWidth} minmax(0,1fr)` }}
    >
      <aside className="min-h-0 overflow-y-auto border-r border-border/40">
        {rail}
      </aside>
      <div className="min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}
