"use client";
import { BookOpen, HelpCircle, Keyboard } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../primitives/popover.js";
import { Kbd } from "../primitives/kbd.js";

export interface HelpMenuProps {
  onShowShortcuts: () => void;
  docsHref?: string;
  appVersion?: string;
}

export function HelpMenu({
  onShowShortcuts,
  docsHref = "/docs",
  appVersion,
}: HelpMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Help"
          className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted-2 transition-colors hover:bg-bg-elev-2 hover:text-fg"
        >
          <HelpCircle size={14} strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        <a
          href={docsHref}
          className="flex items-center gap-2.5 rounded px-2 py-1.5 text-[13px] text-fg-muted transition-colors hover:bg-bg-elev-2 hover:text-fg"
        >
          <BookOpen size={13} strokeWidth={1.5} className="text-fg-muted-2" />
          <span>Open docs</span>
        </a>
        <button
          type="button"
          onClick={onShowShortcuts}
          className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[13px] text-fg-muted transition-colors hover:bg-bg-elev-2 hover:text-fg"
        >
          <div className="flex items-center gap-2.5">
            <Keyboard size={13} strokeWidth={1.5} className="text-fg-muted-2" />
            <span>Keyboard shortcuts</span>
          </div>
          <Kbd>?</Kbd>
        </button>
        {appVersion && (
          <div className="mt-1 border-t border-border/60 px-2 py-1.5 text-2xs text-fg-muted-2">
            eval-kit v{appVersion}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
