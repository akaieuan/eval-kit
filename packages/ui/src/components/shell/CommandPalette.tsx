"use client";
import { Command } from "cmdk";
import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/cn.js";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../primitives/dialog.js";
import { Kbd } from "../primitives/kbd.js";

export interface CommandContext {
  router: { push: (href: string) => void };
  closePalette: () => void;
}

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string[];
  group?: "Navigate" | "Actions" | "Learn";
  perform: (ctx: CommandContext) => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: CommandAction[];
  router: { push: (href: string) => void };
  triggerLabel?: ReactNode;
}

export function CommandPalette({
  open,
  onOpenChange,
  actions,
  router,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const groups = actions.reduce<Record<string, CommandAction[]>>(
    (acc, action) => {
      const key = action.group ?? "Actions";
      (acc[key] ??= []).push(action);
      return acc;
    },
    {},
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-w-xl p-0 gap-0 overflow-hidden"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command
          className="w-full"
          filter={(value, search) => {
            if (!search) return 1;
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <div className="flex items-center gap-2.5 border-b border-border/70 px-3.5 py-3">
            <Search size={13} strokeWidth={1.5} className="text-fg-muted-2" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search actions, runs, docs…"
              className="flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-muted-2"
            />
            <Kbd>ESC</Kbd>
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-6 text-center text-xs text-fg-muted">
              No results.
            </Command.Empty>
            {Object.entries(groups).map(([groupName, items]) => (
              <Command.Group
                key={groupName}
                heading={groupName}
                className={cn(
                  "px-1 py-1",
                  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5",
                  "[&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-muted-2",
                )}
              >
                {items.map((action) => (
                  <Command.Item
                    key={action.id}
                    value={`${action.label} ${action.hint ?? ""}`}
                    onSelect={() =>
                      action.perform({
                        router,
                        closePalette: () => onOpenChange(false),
                      })
                    }
                    className={cn(
                      "flex cursor-default items-center justify-between gap-2 rounded px-2.5 py-1.5 text-[13px] text-fg-muted",
                      "data-[selected=true]:bg-bg-elev-2 data-[selected=true]:text-fg-strong",
                    )}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{action.label}</span>
                      {action.hint && (
                        <span className="truncate text-2xs text-fg-muted">
                          {action.hint}
                        </span>
                      )}
                    </div>
                    {action.shortcut && (
                      <div className="flex gap-1">
                        {action.shortcut.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </div>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
