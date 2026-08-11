import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Contrast is a build-time property of the tokens, so it is tested like one.
 *
 * This exists because a token rename silently destroyed readability across the
 * whole app: shadcn's `--muted` is a SURFACE, eval-kit's `--muted` had been the
 * muted FOREGROUND, and after the contract landed every muted label rendered
 * at 26,26,25 on a 10,10,9 ground. Nothing failed — not the build, not
 * typecheck, not a single test — because no check knew what these values are
 * FOR. `--muted-2` was independently below AA on every surface (2.5–3.6:1) and
 * had been since long before that.
 *
 * WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large text and UI boundaries.
 */

const DIR = dirname(fileURLToPath(import.meta.url));
const TOKENS = readFileSync(join(DIR, "tokens.css"), "utf8");
const THEMES = TOKENS; // palettes and shared tokens live in one stylesheet

/** Every palette in the generated registry. */
const PALETTES = [
  "neutral", "zinc", "slate", "stone", "gray",
  "red", "rose", "orange", "green", "blue", "yellow", "violet",
] as const;

/**
 * Read a triple from a palette block. Scans EVERY block matching the selector
 * and returns the first that defines the token — tokens.css emits a shared
 * `:root` (radius, fonts, shadows) before the neutral palette's `:root`, so
 * taking the first match alone finds a block with no colours in it.
 */
function paletteToken(
  palette: string,
  name: string,
  theme: "light" | "dark",
): [number, number, number] {
  const sel =
    palette === "neutral"
      ? theme === "light" ? ":root {" : ".dark {"
      : theme === "light"
        ? `[data-theme="${palette}"] {`
        : `[data-theme="${palette}"].dark {`;
  const re = new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`);
  let from = 0;
  for (;;) {
    const start = THEMES.indexOf(sel, from);
    if (start < 0) break;
    // A bare `.dark {` also matches `[data-theme="x"].dark {`; skip those when
    // we asked for the default palette.
    const prevChar = THEMES[start - 1];
    const isScoped = prevChar === "]" || prevChar === '"';
    if (!(palette === "neutral" && theme === "dark" && isScoped)) {
      const block = THEMES.slice(start, THEMES.indexOf("}", start));
      const m = re.exec(block);
      if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    }
    from = start + sel.length;
  }
  throw new Error(`--${name} not found in ${sel} (${palette}/${theme})`);
}

function token(name: string, theme: "light" | "dark"): [number, number, number] {
  return paletteToken("neutral", name, theme);
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Surfaces that body text actually lands on. `secondary` and `accent` are
 * excluded deliberately: they are hover/fill states that carry CONTROL labels,
 * not prose, and shadcn's own preset puts muted-foreground at 4.35:1 and
 * 4.01:1 on them. Those are checked at the 3:1 UI threshold below rather than
 * silently held to a bar the upstream theme does not meet.
 */
const SURFACES = ["bg", "sidebar", "card"] as const;
const UI_SURFACES = ["secondary", "accent"] as const;
/** Text tokens and the minimum ratio each must clear on every surface. */
const TEXT: { name: string; min: number }[] = [
  { name: "fg", min: 4.5 },
  { name: "fg-strong", min: 4.5 },
  { name: "muted-foreground", min: 4.5 },
  { name: "muted-2", min: 4.5 },
];
/** Status colours carry words (GATE VIOLATED, DISTRACTION), so they are body text. */
const STATUS: string[] = ["good", "warn", "danger", "brand"];

describe.each(["light", "dark"] as const)("%s theme contrast", (theme) => {
  it.each(TEXT)("$name clears $min:1 on every surface", ({ name, min }) => {
    const fg = token(name, theme);
    for (const s of SURFACES) {
      const ratio = contrast(fg, token(s, theme));
      expect(
        ratio,
        `--${name} on --${s} is ${ratio.toFixed(2)}:1, below ${min}:1`,
      ).toBeGreaterThanOrEqual(min);
    }
  });

  it.each(TEXT)("$name clears the 3:1 UI bar on hover/fill surfaces", ({ name }) => {
    const fg = token(name, theme);
    for (const s of UI_SURFACES) {
      const ratio = contrast(fg, token(s, theme));
      expect(
        ratio,
        `--${name} on --${s} is ${ratio.toFixed(2)}:1, below 3:1`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(STATUS)("status colour %s clears 4.5:1 on bg and card", (name) => {
    const fg = token(name, theme);
    for (const s of ["bg", "card"] as const) {
      const ratio = contrast(fg, token(s, theme));
      expect(
        ratio,
        `--${name} on --${s} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("surfaces form a visible elevation ladder", () => {
    // Chrome must be distinguishable from content — the whole reason the
    // sidebar family was added. Adjacent steps need a real delta.
    const bg = luminance(token("bg", theme));
    const sidebar = luminance(token("sidebar", theme));
    expect(Math.abs(sidebar - bg)).toBeGreaterThan(0.0005);
  });
});

/**
 * Every generated palette is held to the same bar as the default. A theme
 * picker that ships an unreadable option is worse than not shipping it.
 */
describe.each(PALETTES)("palette %s", (palette) => {
  describe.each(["light", "dark"] as const)("%s", (theme) => {
    it("body text clears 4.5:1 on bg, sidebar and card", () => {
      for (const t of ["fg", "muted-foreground"]) {
        const fg = paletteToken(palette, t, theme);
        for (const s of ["bg", "sidebar", "card"]) {
          const ratio = contrast(fg, paletteToken(palette, s, theme));
          expect(
            ratio,
            `${palette}/${theme}: --${t} on --${s} is ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it("primary-foreground is readable on primary", () => {
      const ratio = contrast(
        paletteToken(palette, "primary-foreground", theme),
        paletteToken(palette, "primary", theme),
      );
      expect(
        ratio,
        `${palette}/${theme}: primary pair is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    });

    it("sidebar is a distinct surface from content", () => {
      const bg = luminance(paletteToken(palette, "bg", theme));
      const sb = luminance(paletteToken(palette, "sidebar", theme));
      expect(Math.abs(sb - bg)).toBeGreaterThan(0.0005);
    });
  });
});
