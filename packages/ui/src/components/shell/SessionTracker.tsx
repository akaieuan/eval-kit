"use client";
import { Flame, TimerReset } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn.js";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../primitives/popover.js";

const STORAGE_KEY = "eval-kit:session-v1";

interface SessionState {
  startedAt: string;
  scoredCount: number;
  lastScoredAt: string | null;
}

function readSession(): SessionState {
  if (typeof window === "undefined") {
    return { startedAt: new Date().toISOString(), scoredCount: 0, lastScoredAt: null };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionState;
      if (parsed.startedAt) return parsed;
    }
  } catch {
    // fall through
  }
  const fresh = {
    startedAt: new Date().toISOString(),
    scoredCount: 0,
    lastScoredAt: null,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

function writeSession(next: SessionState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/**
 * Public API: bump the session score counter. Other components call this
 * after a successful inline score / autosave to keep the tracker in sync.
 */
export function recordScoreInSession(): void {
  if (typeof window === "undefined") return;
  const current = readSession();
  const next: SessionState = {
    ...current,
    scoredCount: current.scoredCount + 1,
    lastScoredAt: new Date().toISOString(),
  };
  writeSession(next);
  window.dispatchEvent(new CustomEvent("eval-kit:session-updated"));
}

function formatDuration(fromIso: string): string {
  const ms = Date.now() - new Date(fromIso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 1) return "< 1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export interface SessionTrackerProps {
  className?: string;
}

export function SessionTracker({ className }: SessionTrackerProps) {
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    setSession(readSession());
    function onUpdate() {
      setSession(readSession());
    }
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setSession(readSession());
    }
    window.addEventListener("eval-kit:session-updated", onUpdate);
    window.addEventListener("storage", onStorage);
    // Tick every minute for the duration label.
    const tick = setInterval(() => setSession(readSession()), 60000);
    return () => {
      window.removeEventListener("eval-kit:session-updated", onUpdate);
      window.removeEventListener("storage", onStorage);
      clearInterval(tick);
    };
  }, []);

  if (!session) return null;

  const perMin =
    session.scoredCount > 0
      ? session.scoredCount /
        Math.max(1, (Date.now() - new Date(session.startedAt).getTime()) / 60000)
      : 0;

  function reset() {
    const fresh = {
      startedAt: new Date().toISOString(),
      scoredCount: 0,
      lastScoredAt: null,
    };
    writeSession(fresh);
    setSession(fresh);
    window.dispatchEvent(new CustomEvent("eval-kit:session-updated"));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-elev px-2 py-1 text-2xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg",
            className,
          )}
          aria-label="Review session stats"
        >
          <Flame
            size={11}
            strokeWidth={1.5}
            className={cn(
              session.scoredCount > 0 ? "text-accent" : "text-fg-muted-2",
            )}
          />
          <span className="tabular-nums">{session.scoredCount}</span>
          <span className="text-fg-muted-2">·</span>
          <span className="tabular-nums text-fg-muted-2">
            {formatDuration(session.startedAt)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-4">
        <div className="text-[13px] font-normal tracking-tight text-fg-strong">
          Review session
        </div>
        <p className="mt-0.5 text-2xs text-fg-muted">
          Resets when you click "start new."
        </p>
        <dl className="mt-3 space-y-1.5 text-xs">
          <Row
            label="Scored"
            value={
              <span className="tabular-nums text-fg-strong">
                {session.scoredCount}
              </span>
            }
          />
          <Row
            label="Duration"
            value={
              <span className="tabular-nums text-fg-muted">
                {formatDuration(session.startedAt)}
              </span>
            }
          />
          <Row
            label="Pace"
            value={
              <span className="tabular-nums text-fg-muted">
                {perMin >= 0.1 ? `${perMin.toFixed(1)}/min` : "—"}
              </span>
            }
          />
          <Row
            label="Started"
            value={
              <span className="tabular-nums text-fg-muted-2">
                {new Date(session.startedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            }
          />
          {session.lastScoredAt && (
            <Row
              label="Last score"
              value={
                <span className="tabular-nums text-fg-muted-2">
                  {new Date(session.lastScoredAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              }
            />
          )}
        </dl>
        <button
          type="button"
          onClick={reset}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-bg-elev px-2 py-1.5 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
        >
          <TimerReset size={11} strokeWidth={1.5} />
          Start new session
        </button>
      </PopoverContent>
    </Popover>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-2xs uppercase tracking-wider text-fg-muted-2">
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
