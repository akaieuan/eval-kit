"use client";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { Pill } from "../primitives/pill.js";
import { Tooltip } from "../primitives/tooltip.js";
import { Kbd } from "../primitives/kbd.js";

export interface SidebarNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  shortcut?: string;
  badge?: ReactNode;
  external?: boolean;
}

export interface SidebarNavGroup {
  label?: string;
  items: SidebarNavItem[];
}

export interface SidebarNavProps {
  groups: SidebarNavGroup[];
  currentPath: string;
  header?: ReactNode;
  footer?: ReactNode;
}

export function SidebarNav({
  groups,
  currentPath,
  header,
  footer,
}: SidebarNavProps) {
  return (
    <nav className="flex h-full w-[clamp(200px,15vw,240px)] flex-col border-r border-border/70 bg-bg px-3 py-3">
      {header && (
        <div className="mb-4 flex items-center gap-2 px-2 py-1.5">{header}</div>
      )}

      <div className="flex-1 space-y-5 overflow-y-auto">
        {groups.map((group, gIdx) => (
          <div key={group.label ?? gIdx}>
            {group.label && (
              <div className="mb-2 px-2 text-[10px] uppercase tracking-wider text-fg-muted-2">
                {group.label}
              </div>
            )}
            <ul className="space-y-px">
              {group.items.map((item) => {
                const active =
                  currentPath === item.href ||
                  (item.href !== "/" && currentPath.startsWith(item.href));
                const Icon = item.icon;
                const body = (
                  <a
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                      active
                        ? "bg-bg-elev-2 text-fg-strong"
                        : "text-fg-muted hover:bg-bg-elev-2/60 hover:text-fg",
                    )}
                  >
                    <Icon
                      size={14}
                      strokeWidth={1.5}
                      className={cn(
                        "flex-shrink-0",
                        active ? "text-fg-strong" : "text-fg-muted-2",
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && <div>{item.badge}</div>}
                    {item.shortcut && !active && (
                      <span className="opacity-0 group-hover:opacity-100">
                        <Kbd>{item.shortcut}</Kbd>
                      </span>
                    )}
                  </a>
                );
                return (
                  <li key={item.id}>
                    {item.shortcut ? (
                      <Tooltip
                        side="right"
                        content={
                          <div className="flex items-center gap-2">
                            <span>{item.label}</span>
                            <Kbd>{item.shortcut}</Kbd>
                          </div>
                        }
                      >
                        {body}
                      </Tooltip>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {footer && (
        <div className="mt-3 border-t border-border/60 pt-3">{footer}</div>
      )}
    </nav>
  );
}

export function SidebarBadge({ children }: { children: ReactNode }) {
  return (
    <Pill className="px-1.5 py-0 text-[10px]" dot="warn">
      {children}
    </Pill>
  );
}
