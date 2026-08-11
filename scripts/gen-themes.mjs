#!/usr/bin/env node
// @ts-check
/*
 * gen:themes — generate packages/ui/src/styles/themes.css.
 *
 * Every theme shadcn offers, as a full token contract. Five are neutral BASE
 * scales (neutral, zinc, slate, stone, gray) where primary is the darkest
 * neutral; seven are COLOUR themes (red, rose, orange, green, blue, yellow,
 * violet) which keep a neutral ground and swap primary/ring/sidebar-primary
 * for the hue — that is how shadcn's own themes are built.
 *
 * Generated rather than hand-written so all 24 blocks stay structurally
 * identical and tokens.contrast.test.ts can hold every one to the same bar.
 * `neutral` emits as :root because it is the default (and is the preset
 * imported from ui.shadcn.com/create?preset=bcivVKXQ).
 *
 *   node scripts/gen-themes.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../packages/ui/src/styles/tokens.css");

/** Tailwind neutral scales — shadcn's "Base Color" set. */
const BASES = {
  neutral: { 50:"fafafa",100:"f5f5f5",200:"e5e5e5",300:"d4d4d4",400:"a3a3a3",500:"737373",600:"525252",700:"404040",800:"262626",900:"171717",950:"0a0a0a" },
  zinc:    { 50:"fafafa",100:"f4f4f5",200:"e4e4e7",300:"d4d4d8",400:"a1a1aa",500:"71717a",600:"52525b",700:"3f3f46",800:"27272a",900:"18181b",950:"09090b" },
  slate:   { 50:"f8fafc",100:"f1f5f9",200:"e2e8f0",300:"cbd5e1",400:"94a3b8",500:"64748b",600:"475569",700:"334155",800:"1e293b",900:"0f172a",950:"020617" },
  stone:   { 50:"fafaf9",100:"f5f5f4",200:"e7e5e4",300:"d6d3d1",400:"a8a29e",500:"78716c",600:"57534e",700:"44403c",800:"292524",900:"1c1917",950:"0c0a09" },
  gray:    { 50:"f9fafb",100:"f3f4f6",200:"e5e7eb",300:"d1d5db",400:"9ca3af",500:"6b7280",600:"4b5563",700:"374151",800:"1f2937",900:"111827",950:"030712" },
};

/** Tailwind hue scales for the colour themes. */
const HUES = {
  red:    { 300:"fca5a5",400:"f87171",500:"ef4444",600:"dc2626",700:"b91c1c" },
  rose:   { 300:"fda4af",400:"fb7185",500:"f43f5e",600:"e11d48",700:"be123c" },
  orange: { 300:"fdba74",400:"fb923c",500:"f97316",600:"ea580c",700:"c2410c" },
  green:  { 300:"86efac",400:"4ade80",500:"22c55e",600:"16a34a",700:"15803d" },
  blue:   { 300:"93c5fd",400:"60a5fa",500:"3b82f6",600:"2563eb",700:"1d4ed8" },
  yellow: { 300:"fde047",400:"facc15",500:"eab308",600:"ca8a04",700:"a16207" },
  violet: { 300:"c4b5fd",400:"a78bfa",500:"8b5cf6",600:"7c3aed",700:"6d28d9" },
};

/*
 * Status colours carry WORDS (GATE VIOLATED, DISTRACTION), so they are body
 * text and must clear 4.5:1 on the lightest ground. The 600 steps do not:
 * green-600 is 3.30:1 and amber-600 is 2.94:1 on white. Both step to 700.
 * The 400 steps are already 7-13:1 on the dark ground.
 */
const STATUS = {
  red:   { l:"dc2626", d:"f87171" }, // 4.83 / 7.16
  green: { l:"15803d", d:"4ade80" }, // 5.02 / 11.36
  amber: { l:"a16207", d:"facc15" }, // 4.92 / 12.93
  blue:  { l:"2563eb", d:"60a5fa" }, // 5.17 / 7.79
};

const t = (h) => `${parseInt(h.slice(0,2),16)} ${parseInt(h.slice(2,4),16)} ${parseInt(h.slice(4,6),16)}`;

/** Relative luminance of a hex colour, for picking a readable foreground. */
function lum(h) {
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
/**
 * Pick black or white for text on `bg`, whichever contrasts more.
 * Assuming white broke yellow, green and orange — their 500/600 steps are
 * light enough that white text lands at 1.9-3.6:1.
 */
function onColor(bg, darkHex, lightHex) {
  const L = lum(bg);
  const cw = (1.05) / (L + 0.05);
  const cb = (L + 0.05) / 0.05;
  return cw >= cb ? lightHex : darkHex;
}

/** @param {string} name @param {Record<number,string>} S @param {Record<number,string>|null} H */
function theme(name, S, H) {
  // Colour themes keep the neutral ground and swap the emphasis hue.
  const pL = H ? H[600] : S[900];
  const pD = H ? H[500] : S[200];
  const pFgL = H ? onColor(pL, S[950], "ffffff") : S[50];
  const pFgD = H ? onColor(pD, S[950], "ffffff") : S[900];
  const ringL = H ? H[500] : S[400];
  const ringD = H ? H[500] : S[500];
  const brandL = H ? H[600] : STATUS.blue.l;
  const brandD = H ? H[400] : STATUS.blue.d;

  const light = `
  --background: ${t("ffffff")};
  --foreground: ${t(S[950])};
  --card: ${t("ffffff")};
  --card-foreground: ${t(S[950])};
  --popover: ${t("ffffff")};
  --popover-foreground: ${t(S[950])};
  --primary: ${t(pL)};
  --primary-foreground: ${t(pFgL)};
  --secondary: ${t(S[100])};
  --secondary-foreground: ${t(S[900])};
  --muted: ${t(S[100])};
  --muted-foreground: ${t(S[500])};
  --accent: ${t(S[100])};
  --accent-foreground: ${t(S[900])};
  --destructive: ${t(STATUS.red.l)};
  --destructive-foreground: ${t("ffffff")};
  --border: ${t(S[200])};
  --input: ${t(S[200])};
  --ring: ${t(ringL)};
  --chart-1: ${t((H ?? HUES.blue)[300])}; --chart-2: ${t((H ?? HUES.blue)[400])};
  --chart-3: ${t((H ?? HUES.blue)[500])}; --chart-4: ${t((H ?? HUES.blue)[600])};
  --chart-5: ${t(S[500])};
  --sidebar: ${t(S[50])};
  --sidebar-foreground: ${t(S[950])};
  --sidebar-primary: ${t(pL)};
  --sidebar-primary-foreground: ${t(pFgL)};
  --sidebar-accent: ${t(S[100])};
  --sidebar-accent-foreground: ${t(S[900])};
  --sidebar-border: ${t(S[200])};
  --sidebar-ring: ${t(ringL)};
  --bg: ${t("ffffff")}; --bg-elev: ${t(S[50])}; --bg-elev-2: ${t(S[100])}; --bg-elev-3: ${t(S[200])};
  --fg: ${t(S[950])}; --fg-strong: ${t(S[950])};
  --muted-2: ${t(S[500])}; --border-strong: ${t(S[300])};
  --brand: ${t(brandL)}; --brand-hover: ${t(H ? H[700] : STATUS.blue.l)}; --brand-pressed: ${t(H ? H[700] : STATUS.blue.l)};
  --good: ${t(STATUS.green.l)}; --warn: ${t(STATUS.amber.l)}; --danger: ${t(STATUS.red.l)}; --info: ${t(brandL)};`;

  const dark = `
  --background: ${t(S[950])};
  --foreground: ${t(S[50])};
  --card: ${t(S[900])};
  --card-foreground: ${t(S[50])};
  --popover: ${t(S[900])};
  --popover-foreground: ${t(S[50])};
  --primary: ${t(pD)};
  --primary-foreground: ${t(pFgD)};
  --secondary: ${t(S[800])};
  --secondary-foreground: ${t(S[50])};
  --muted: ${t(S[800])};
  --muted-foreground: ${t(S[400])};
  --accent: ${t(S[700])};
  --accent-foreground: ${t(S[50])};
  --destructive: ${t(STATUS.red.d)};
  --destructive-foreground: ${t(S[900])};
  --border: ${t(S[800])};
  --input: ${t(S[700])};
  --ring: ${t(ringD)};
  --chart-1: ${t((H ?? HUES.blue)[300])}; --chart-2: ${t((H ?? HUES.blue)[400])};
  --chart-3: ${t((H ?? HUES.blue)[500])}; --chart-4: ${t((H ?? HUES.blue)[600])};
  --chart-5: ${t(S[400])};
  --sidebar: ${t(S[900])};
  --sidebar-foreground: ${t(S[50])};
  --sidebar-primary: ${t(pD)};
  --sidebar-primary-foreground: ${t(pFgD)};
  --sidebar-accent: ${t(S[800])};
  --sidebar-accent-foreground: ${t(S[50])};
  --sidebar-border: ${t(S[800])};
  --sidebar-ring: ${t(ringD)};
  --bg: ${t(S[950])}; --bg-elev: ${t(S[900])}; --bg-elev-2: ${t(S[800])}; --bg-elev-3: ${t(S[700])};
  --fg: ${t(S[50])}; --fg-strong: ${t("ffffff")};
  --muted-2: ${t(S[400])}; --border-strong: ${t(S[700])};
  --brand: ${t(brandD)}; --brand-hover: ${t(H ? H[300] : STATUS.blue.d)}; --brand-pressed: ${t(H ? H[500] : STATUS.blue.d)};
  --good: ${t(STATUS.green.d)}; --warn: ${t(STATUS.amber.d)}; --danger: ${t(STATUS.red.d)}; --info: ${t(brandD)};`;

  const lSel = name === "neutral" ? ":root" : `[data-theme="${name}"]`;
  const dSel = name === "neutral" ? ".dark" : `[data-theme="${name}"].dark`;
  return `${lSel} {${light}\n}\n\n${dSel} {${dark}\n}`;
}


/** Radius, fonts and shadows do not vary by palette. */
const SHARED = `
:root {
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;

  --shadow-sm: 0 0 0 0 transparent;
  --shadow-md: 0 0 0 0 transparent;
  --shadow-lg: 0 12px 32px rgb(0 0 0 / 0.1), 0 1px 2px rgb(0 0 0 / 0.06);

  --font-sans:
    var(--font-inter), ui-sans-serif, -apple-system, BlinkMacSystemFont,
    "Segoe UI", system-ui, sans-serif;
  --font-mono:
    var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace;

  color-scheme: light;
}

.dark {
  --shadow-lg: 0 12px 32px rgb(0 0 0 / 0.55), 0 1px 2px rgb(0 0 0 / 0.35);
  color-scheme: dark;
}
`;

const blocks = [];
for (const [name, S] of Object.entries(BASES)) blocks.push(theme(name, S, null));
for (const [name, H] of Object.entries(HUES)) blocks.push(theme(name, BASES.zinc, H));

const header = `/*
 * Theme registry — GENERATED by scripts/gen-themes.mjs. Do not hand-edit.
 *
 * Every theme shadcn offers, each a complete token contract:
 *   base scales  neutral zinc slate stone gray   (primary = darkest neutral)
 *   colour       red rose orange green blue yellow violet
 *                (zinc ground, hue on primary / ring / sidebar-primary —
 *                 the way shadcn's own colour themes are built)
 *
 * Selection: data-theme on <html> picks the palette, .dark picks the mode.
 * \`neutral\` emits as :root because it is the default, and is the preset
 * imported from ui.shadcn.com/create?preset=bcivVKXQ.
 *
 * Values are "R G B" triples — eval-kit is Tailwind v3, whose alpha syntax
 * needs them. Regenerate with: node scripts/gen-themes.mjs
 */
`;
writeFileSync(OUT, header + SHARED + "\n" + blocks.join("\n\n") + "\n");
console.log(`tokens.css — ${Object.keys(BASES).length + Object.keys(HUES).length} themes x 2 modes`);
