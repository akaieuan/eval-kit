"use client";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../../lib/cn.js";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover.js";
import { MICRO } from "../../lib/type.js";

const MODE_KEY = "eval-kit:theme";
const PALETTE_KEY = "eval-kit:palette";

export type Theme = "light" | "dark";
export type Mode = Theme | "system";

/** Every palette in the registry (packages/ui/src/styles/themes.css). */
export const PALETTES = [
  { id: "neutral", label: "Neutral" },
  { id: "zinc", label: "Zinc" },
  { id: "slate", label: "Slate" },
  { id: "stone", label: "Stone" },
  { id: "gray", label: "Gray" },
  { id: "red", label: "Red" },
  { id: "rose", label: "Rose" },
  { id: "orange", label: "Orange" },
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
  { id: "yellow", label: "Yellow" },
  { id: "violet", label: "Violet" },
] as const;

export type Palette = (typeof PALETTES)[number]["id"];

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches === true
  );
}

export function readMode(): Mode {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem(MODE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "dark";
}

export function readPalette(): Palette {
  if (typeof window === "undefined") return "neutral";
  const v = window.localStorage.getItem(PALETTE_KEY);
  return PALETTES.some((p) => p.id === v) ? (v as Palette) : "neutral";
}

/** Resolve `system` against the OS and set `.dark` on <html>. */
export function applyMode(mode: Mode) {
  if (typeof document === "undefined") return;
  const dark = mode === "dark" || (mode === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

/** `neutral` is :root, so it carries no attribute. */
export function applyPalette(palette: Palette) {
  if (typeof document === "undefined") return;
  if (palette === "neutral") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", palette);
}

/** Backwards-compatible aliases — the old API was mode-only. */
export const readTheme = readMode;
export const applyTheme = applyMode;

const MODES: { id: Mode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

export interface ThemeToggleProps {
  className?: string;
}

/**
 * Mode + palette selector.
 *
 * Was a two-state light/dark button; the app now ships twelve palettes, so a
 * toggle can no longer express the choice. Mode and palette are stored
 * separately because they are independent axes — picking Rose should not
 * disturb whether you are in dark mode.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const [mode, setMode] = useState<Mode>("dark");
  const [palette, setPalette] = useState<Palette>("neutral");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const m = readMode();
    const p = readPalette();
    setMode(m);
    setPalette(p);
    applyMode(m);
    applyPalette(p);
  }, []);

  // Follow the OS while mode is `system`.
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyMode("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const chooseMode = useCallback((next: Mode) => {
    setMode(next);
    applyMode(next);
    window.localStorage.setItem(MODE_KEY, next);
  }, []);

  const choosePalette = useCallback((next: Palette) => {
    setPalette(next);
    applyPalette(next);
    window.localStorage.setItem(PALETTE_KEY, next);
  }, []);

  const ActiveIcon = MODES.find((m) => m.id === mode)?.icon ?? Moon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Theme"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-secondary hover:text-fg",
            className,
          )}
        >
          <ActiveIcon size={13} strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <div className={cn(MICRO, "mb-2")}>Mode</div>
        <div className="mb-4 grid grid-cols-3 gap-1">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => chooseMode(id)}
              aria-pressed={mode === id}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] transition-colors",
                mode === id
                  ? "border-border-strong bg-secondary text-fg"
                  : "border-border/60 text-fg-muted hover:bg-secondary/60 hover:text-fg",
              )}
            >
              <Icon size={13} strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>

        <div className={cn(MICRO, "mb-2")}>Palette</div>
        <div className="grid grid-cols-2 gap-1">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choosePalette(p.id)}
              aria-pressed={palette === p.id}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors",
                palette === p.id
                  ? "bg-secondary text-fg"
                  : "text-fg-muted hover:bg-secondary/60 hover:text-fg",
              )}
            >
              {/* The swatch renders in the palette it selects, so the choice
                  is legible without applying it first. */}
              <span
                aria-hidden
                data-theme={p.id === "neutral" ? undefined : p.id}
                className="size-3 shrink-0 rounded-full border border-border bg-primary"
              />
              <span className="truncate">{p.label}</span>
              {palette === p.id && (
                <Check size={11} strokeWidth={2} className="ml-auto shrink-0" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Applies the stored mode AND palette before hydration so there is no flash of
 * the default theme. Render inside <head>:
 *   <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
 */
export const themeInitScript = `
(function() {
  try {
    var m = localStorage.getItem("${MODE_KEY}") || "dark";
    var dark = m === "dark" || (m === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
    var p = localStorage.getItem("${PALETTE_KEY}");
    if (p && p !== "neutral") document.documentElement.setAttribute("data-theme", p);
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;
