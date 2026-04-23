"use client";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { TooltipProvider } from "../primitives/tooltip.js";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  shortcut?: string;
};

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export interface AppShellProps {
  sidebar: ReactNode;
  topbar?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
  className?: string;
}

export function AppShell({
  sidebar,
  topbar,
  breadcrumbs,
  children,
  className,
}: AppShellProps) {
  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={500}>
      <div className={cn("flex min-h-dvh bg-bg text-fg", className)}>
        <aside className="sticky top-0 h-dvh flex-shrink-0">{sidebar}</aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-11 flex-shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-bg/85 px-[clamp(1rem,2vw,1.75rem)] backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-2">
              {breadcrumbs && breadcrumbs.length > 0 && (
                <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
                  {breadcrumbs.map((item, i) => {
                    const last = i === breadcrumbs.length - 1;
                    return (
                      <span
                        key={i}
                        className={cn(
                          "flex items-center gap-1.5",
                          last ? "text-fg-strong" : "text-fg-muted",
                        )}
                      >
                        {item.href && !last ? (
                          <a
                            href={item.href}
                            className="hover:text-fg truncate max-w-[180px]"
                          >
                            {item.label}
                          </a>
                        ) : (
                          <span className="truncate max-w-[240px]">
                            {item.label}
                          </span>
                        )}
                        {!last && (
                          <ChevronRight
                            size={11}
                            strokeWidth={1.5}
                            className="text-fg-muted-2"
                          />
                        )}
                      </span>
                    );
                  })}
                </nav>
              )}
            </div>
            <div className="flex items-center gap-1">{topbar}</div>
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
