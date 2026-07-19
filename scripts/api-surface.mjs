#!/usr/bin/env node
// @ts-check
/*
 * api-surface — turn breaking public-API changes into conscious, reviewed diffs.
 *
 * For each publishable package it walks the `exports`-map type entrypoints, follows their relative
 * declaration imports transitively (the tsup/rollup chunk files), normalizes the volatile bits
 * (content-hashed chunk filenames like `ci-Q9Ktw9zQ.d.ts` -> `ci.d.ts`, sourcemap comments), and
 * writes the concatenated public `.d.ts` surface to `api-surface/<pkg>.d.ts`.
 *
 * It then fails if the committed snapshot differs from what was just regenerated (registry:check
 * style: regenerate + `git diff --exit-code`). A diff is not a freeze — it's the signal to review the
 * change and commit the new surface on purpose. Run `pnpm build` first so `dist` is fresh.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outDir = join(repoRoot, "api-surface");

/** Replace an 8-char content hash suffix in relative .js/.d.ts specifiers and filenames. */
const stripHash = (s) => s.replace(/-[A-Za-z0-9_-]{8}(\.d\.ts|\.js)/g, "$1");

/** Resolve a relative declaration import to an on-disk .d.ts path. */
function resolveDts(fromFile, spec) {
  let base = join(dirname(fromFile), spec);
  if (base.endsWith(".js")) base = base.slice(0, -3) + ".d.ts";
  else if (!base.endsWith(".d.ts")) base += ".d.ts";
  if (existsSync(base)) return base;
  const idx = base.replace(/\.d\.ts$/, "/index.d.ts");
  if (existsSync(idx)) return idx;
  return null;
}

/** Gather the transitive closure of public .d.ts files from the exports-map type entrypoints. */
function collectSurface(dir, pj) {
  const exportsMap = pj.exports ?? { ".": { types: pj.types } };
  const seeds = [];
  for (const val of Object.values(exportsMap)) {
    const t = typeof val === "string" ? val : val.types;
    if (t && t.endsWith(".d.ts")) seeds.push(resolve(dir, t));
  }
  if (pj.types) seeds.push(resolve(dir, pj.types));

  const seen = new Set();
  const queue = seeds.filter((f) => f && existsSync(f));
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readFileSync(f, "utf8");
    const specs = [...src.matchAll(/(?:from|import)\s*['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
    for (const spec of specs) {
      const target = resolveDts(f, spec);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return [...seen];
}

/*
 * Canonicalize into a deterministic form. tsup/rollup-dts emits the members of zod-inferred
 * object/union types in a NON-deterministic order run-to-run (verified: the same `pnpm build`
 * alternates the order of properties inside `z.ZodObject<{...}>` bodies, including moves across
 * nested-property blocks and intersection/union connectors). A structural sort can't safely handle
 * those `} & ({...} | {...})` connectors, so we canonicalize each file to a SORTED MULTISET of its
 * trimmed declaration lines: any pure reordering preserves the multiset (→ stable), while any added,
 * removed, or retyped member changes a line (→ a real, reviewable diff). The snapshot is therefore a
 * sorted inventory of the public type surface, not pretty-printed TypeScript — that's the trade for a
 * gate that never flakes. Type NAMES and shapes are still fully captured; only cosmetic order is lost.
 */
function canonicalize(text) {
  return stripHash(text)
    .split("\n")
    .map((l) => l.trim())
    // Keep only lines that carry an identifier (property/type/signature). Pure-punctuation lines
    // (`}`, `};`, `}>`, `}, {`, ...) encode no API surface on their own and only add noise; a real
    // API change always alters an identifier-bearing line too.
    .filter((l) => /[A-Za-z]/.test(l) && !l.startsWith("//# sourceMappingURL="))
    .sort((a, b) => a.localeCompare(b))
    .join("\n");
}

function normalize(dir, files) {
  const entries = files.map((abs) => ({
    relName: stripHash(relative(dir, abs).split("\\").join("/")),
    body: canonicalize(readFileSync(abs, "utf8")),
  }));
  entries.sort((a, b) => a.relName.localeCompare(b.relName));
  return entries.map((e) => `// ===== ${e.relName} (sorted line inventory) =====\n${e.body}\n`).join("\n");
}

// ---- regenerate --------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
const pkgsDir = join(repoRoot, "packages");
const generated = [];
for (const entry of readdirSync(pkgsDir)) {
  const pjPath = join(pkgsDir, entry, "package.json");
  if (!existsSync(pjPath)) continue;
  const pj = JSON.parse(readFileSync(pjPath, "utf8"));
  if (pj.private === true) continue;
  const dir = join(pkgsDir, entry);
  const files = collectSurface(dir, pj);
  if (files.length === 0) { console.error(`api-surface: no .d.ts found for ${pj.name} — did you build?`); process.exit(1); }
  const outName = `${entry}.d.ts`;
  const header = `// AUTO-GENERATED by scripts/api-surface.mjs — do not edit by hand.\n// Public type surface of ${pj.name}. Regenerate with \`pnpm api:check\`.\n// A diff here is a public-API change: review it, then commit this file on purpose.\n\n`;
  writeFileSync(join(outDir, outName), header + normalize(dir, files) + "\n");
  generated.push(outName);
  console.log(`  wrote api-surface/${outName} (${files.length} declaration file(s))`);
}

// ---- verify against committed snapshot --------------------------------------------
const status = spawnSync("git", ["status", "--porcelain", "--", "api-surface/"], { cwd: repoRoot, encoding: "utf8" });
if (status.status !== 0) { console.error("api-surface: could not run git status"); process.exit(1); }
if (status.stdout.trim() !== "") {
  console.error("\napi-surface: FAILED — the public type surface changed (or is uncommitted):\n");
  const diff = spawnSync("git", ["--no-pager", "diff", "--", "api-surface/"], { cwd: repoRoot, encoding: "utf8" });
  process.stderr.write(diff.stdout || status.stdout);
  console.error("\nIf this change is intentional, review the diff and commit api-surface/.\n");
  process.exit(1);
}
console.log("\napi-surface: OK — public type surface matches the committed snapshot\n");
