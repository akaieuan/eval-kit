"use client";
import { Check, CloudOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn.js";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface AutosaveBadgeProps {
  status: AutosaveStatus;
  savedAt?: Date | null;
  errorMessage?: string;
  className?: string;
}

function relative(from: Date): string {
  const secs = Math.floor((Date.now() - from.getTime()) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export function AutosaveBadge({
  status,
  savedAt,
  errorMessage,
  className,
}: AutosaveBadgeProps) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!savedAt) return;
    const id = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [savedAt]);

  const styles = {
    idle: "text-fg-muted-2 bg-transparent",
    saving: "text-info bg-info/8",
    saved: "text-good bg-good/8",
    error: "text-danger bg-danger/8",
  }[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-2xs",
        styles,
        className,
      )}
      title={status === "error" ? errorMessage : undefined}
    >
      {status === "saving" && (
        <>
          <Loader2 size={10} strokeWidth={1.5} className="animate-spin" /> Saving…
        </>
      )}
      {status === "saved" && (
        <>
          <Check size={10} strokeWidth={1.5} />{" "}
          {savedAt ? `Saved ${relative(savedAt)}` : "Saved"}
        </>
      )}
      {status === "error" && (
        <>
          <CloudOff size={10} strokeWidth={1.5} /> Save failed
        </>
      )}
      {status === "idle" && <>Unsaved</>}
    </div>
  );
}
