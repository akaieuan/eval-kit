"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn.js";

const STORAGE_KEY = "eval-kit:theme";
export type Theme = "light" | "dark";

export function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const initial = readTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-fg-muted-2 transition-colors hover:bg-bg-elev-2 hover:text-fg",
        className,
      )}
    >
      {theme === "dark" ? (
        <Sun size={13} strokeWidth={1.5} />
      ) : (
        <Moon size={13} strokeWidth={1.5} />
      )}
    </button>
  );
}

/**
 * Inline script to apply the stored theme before hydration, preventing a
 * flash of the default theme. Render this as:
 *   <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
 * inside <head>.
 */
export const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem("${STORAGE_KEY}");
    if (t !== "light") document.documentElement.classList.add("dark");
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;
