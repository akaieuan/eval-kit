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

/*
 * akaOSS's aside idiom: a hairline rule on the left, no fill, no box.
 * Accents are punctuation — a dot, a rule, a date — and never a background
 * wash, so the old accent-tinted panel read as foreign the moment the rest of
 * the app moved into the house palette. Tone lives in the marker only.
 */
const variantClasses = {
  info: "border-l-border/60 text-fg-muted",
  accent: "border-l-accent/50 text-fg-muted",
  warn: "border-l-warn/60 text-fg-muted",
};

const markerClasses = {
  info: "bg-fg-muted-2",
  accent: "bg-brand",
  warn: "bg-warn",
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
        "flex items-start gap-3 border-l pl-4 pr-2 py-1 text-[13px] leading-relaxed",
        variantClasses[variant],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-[0.55rem] size-1.5 flex-shrink-0 rounded-full",
          markerClasses[variant],
        )}
      />
      <div className="flex-1">
        {title && (
          <div className="mb-0.5 font-light tracking-tight text-fg-strong">
            {title}
          </div>
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
