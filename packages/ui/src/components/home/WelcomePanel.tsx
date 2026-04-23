"use client";
import {
  FileCode,
  PlayCircle,
  ClipboardCheck,
  GitCompare,
  Rocket,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn.js";
import { Kbd } from "../primitives/kbd.js";

const STORAGE_KEY = "eval-kit:welcome-dismissed";

const STEPS = [
  {
    icon: FileCode,
    title: "Author a suite",
    body: "Write YAML tasks or paste a real transcript and let Claude draft one.",
    shortcut: "g s",
  },
  {
    icon: PlayCircle,
    title: "Run against your agent",
    body: "Write one adapter that wraps your agent, run the suite with the CLI.",
    shortcut: "cli",
  },
  {
    icon: ClipboardCheck,
    title: "Score by hand",
    body: "Open a run, grade each step with j/k and 1–3. Humans score, not LLMs.",
    shortcut: "g r",
  },
  {
    icon: GitCompare,
    title: "Diff versions",
    body: "Compare two scored runs and see what regressed.",
    shortcut: "g d",
  },
  {
    icon: Rocket,
    title: "Ship",
    body: "Iterate on your agent with real feedback from real tasks.",
  },
];

export function WelcomePanel({ className }: { className?: string }) {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/80 bg-bg-elev px-6 py-6",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, "1");
          }
        }}
        aria-label="Dismiss welcome"
        className="absolute right-3 top-3 rounded p-1 text-fg-muted-2 transition-colors hover:bg-bg-elev-2 hover:text-fg"
      >
        <X size={13} strokeWidth={1.5} />
      </button>

      <div className="mb-1.5 text-2xs uppercase tracking-wider text-fg-muted-2">
        Welcome to eval-kit
      </div>
      <h2 className="text-[20px] font-light tracking-tight text-fg-strong">
        How the scoring cockpit works
      </h2>
      <p className="mt-2 max-w-2xl text-[13px] text-fg-muted leading-relaxed">
        eval-kit measures collaborative task performance on real human
        workflows — the human is always the judge. This takes five steps.
      </p>

      <ol className="mt-6 grid gap-2 md:grid-cols-5">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <li
              key={i}
              className="flex flex-col rounded-lg border border-border/70 bg-bg p-3.5"
            >
              <div className="flex items-center justify-between">
                <Icon size={14} strokeWidth={1.5} className="text-fg-muted" />
                <span className="font-mono text-2xs text-fg-muted-2">
                  0{i + 1}
                </span>
              </div>
              <div className="mt-3 text-xs font-normal text-fg-strong">
                {step.title}
              </div>
              <p className="mt-1 flex-1 text-2xs leading-relaxed text-fg-muted">
                {step.body}
              </p>
              {step.shortcut && (
                <div className="mt-2.5">
                  <Kbd>{step.shortcut}</Kbd>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
