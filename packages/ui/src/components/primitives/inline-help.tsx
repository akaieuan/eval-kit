"use client";
import { Info, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface InlineHelpProps {
  id?: string;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  variant?: "info" | "accent" | "warn";
  className?: string;
}

const variantClasses = {
  info: "border-border/70 bg-bg-elev text-fg-muted",
  accent: "border-accent/20 bg-accent/[0.04] text-fg-muted",
  warn: "border-warn/30 bg-warn/[0.05] text-warn",
};

export function InlineHelp({
  id,
  title,
  children,
  dismissible = true,
  variant = "accent",
  className,
}: InlineHelpProps) {
  const storageKey = id ? `eval-kit:inlinehelp:${id}:dismissed` : null;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(storageKey) === "1") {
      setDismissed(true);
    }
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3.5 py-3 text-xs leading-relaxed",
        variantClasses[variant],
        className,
      )}
    >
      <Info
        size={13}
        strokeWidth={1.5}
        className="mt-0.5 flex-shrink-0 opacity-60"
      />
      <div className="flex-1">
        {title && (
          <div className="mb-0.5 font-normal text-fg-strong">{title}</div>
        )}
        <div>{children}</div>
      </div>
      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setDismissed(true);
            if (storageKey && typeof window !== "undefined") {
              window.localStorage.setItem(storageKey, "1");
            }
          }}
          className="flex-shrink-0 rounded p-0.5 text-fg-muted-2 opacity-60 transition-opacity hover:opacity-100"
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
