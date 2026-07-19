#!/usr/bin/env node
// @ts-check
/*
 * readme-check — do the README examples actually compile?
 *
 * Opt-in convention (documented in CONTRIBUTING.md, "Documentation checks"):
 *   A fenced code block is extracted and typechecked ONLY when its info string is a TypeScript
 *   language (`ts` / `tsx` / `typescript`) AND carries the explicit `check` token:
 *
 *       ```ts check          <- extracted + `tsc --noEmit`
 *       ```tsx check         <- extracted + `tsc --noEmit` (JSX)
 *       ```ts                <- skipped (illustrative snippet)
 *       ```bash / ```json    <- skipped
 *
 *   Opt-in is explicit, never inferred. Blocks are typechecked against the monorepo's BUILT types
 *   (the `@eval-kit/*` packages resolved through the workspace), so run `pnpm build` first.
 *   Each block is compiled as its own ES module (moduleResolution: bundler).
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const TS_LANGS = new Set(["ts", "tsx", "typescript"]);

/** Find README files: repo root + each package. */
function findReadmes() {
  const list = [];
  const rootReadme = join(repoRoot, "README.md");
  if (existsSync(rootReadme)) list.push(rootReadme);
  const pkgsDir = join(repoRoot, "packages");
  if (existsSync(pkgsDir)) {
    for (const entry of readdirSync(pkgsDir)) {
      const p = join(pkgsDir, entry, "README.md");
      if (existsSync(p)) list.push(p);
    }
  }
  return list;
}

/** Parse fenced blocks; return the ones opted-in via `check`. */
function extractCheckedBlocks(file) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const blocks = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^```(.*)$/);
    if (!fence) { if (open) open.body.push(line); continue; }
    if (!open) {
      const tokens = fence[1].trim().split(/\s+/).filter(Boolean);
      const lang = tokens[0] ?? "";
      open = { lang, tokens, startLine: i + 1, body: [], checked: TS_LANGS.has(lang) && tokens.includes("check") };
    } else {
      if (open.checked) blocks.push(open);
      open = null;
    }
  }
  return blocks;
}

const readmes = findReadmes();
console.log(`readme-check: scanning ${readmes.length} README file(s)\n`);

const tmpDir = join(repoRoot, ".readme-check-tmp");
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

const extracted = []; // { file, startLine, tsFile }
let count = 0;
for (const file of readmes) {
  const blocks = extractCheckedBlocks(file);
  const rel = relative(repoRoot, file);
  if (blocks.length === 0) { console.log(`  ${rel}: no \`check\` blocks`); continue; }
  for (const b of blocks) {
    const ext = b.lang === "tsx" ? "tsx" : "ts";
    const base = rel.replace(/[^a-zA-Z0-9]+/g, "_") + `_L${b.startLine}.${ext}`;
    const tsFile = join(tmpDir, base);
    writeFileSync(tsFile, b.body.join("\n") + "\n");
    extracted.push({ file: rel, startLine: b.startLine, tsFile: base });
    count++;
  }
  console.log(`  ${rel}: ${blocks.length} \`check\` block(s)`);
}

if (count === 0) {
  console.log("\nreadme-check: no checked blocks found (nothing to verify)");
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(0);
}

// Workspace packages don't resolve from the repo root (pnpm links them into each package's own
// node_modules), so we build tsconfig `paths` mapping every @eval-kit/* package to its BUILT types
// and every third-party import used by a checked block to its workspace copy. This typechecks the
// examples against the real monorepo deps without a full install.
const require = createRequire(join(repoRoot, "noop.js"));
const candidateModDirs = [
  join(repoRoot, "node_modules"),
  ...readdirSync(join(repoRoot, "packages")).map((p) => join(repoRoot, "packages", p, "node_modules")),
].filter(existsSync);

/** @type {Record<string,string[]>} */
const paths = {};
const typeRoots = candidateModDirs.map((d) => join(d, "@types")).filter(existsSync);

// @eval-kit/* → built types
let builtTypesFound = false;
for (const entry of readdirSync(join(repoRoot, "packages"))) {
  const pjPath = join(repoRoot, "packages", entry, "package.json");
  if (!existsSync(pjPath)) continue;
  const pj = JSON.parse(readFileSync(pjPath, "utf8"));
  if (pj.private === true || !pj.name) continue;
  const dir = join(repoRoot, "packages", entry);
  const typesEntry = pj.types ?? (pj.exports && pj.exports["."] && pj.exports["."].types);
  if (typesEntry && existsSync(resolve(dir, typesEntry))) {
    paths[pj.name] = [resolve(dir, typesEntry)];
    builtTypesFound = true;
  }
  if (existsSync(join(dir, "dist"))) paths[`${pj.name}/*`] = [join(dir, "dist", "*")];
}
if (!builtTypesFound) {
  console.error("\nreadme-check: built types not found — run `pnpm build` first.");
  process.exit(1);
}

// third-party bare imports referenced by checked blocks → workspace copy
const bareImports = new Set();
for (const e of extracted) {
  const src = readFileSync(join(tmpDir, e.tsFile), "utf8");
  for (const m of src.matchAll(/(?:from|import)\s*['"]([^'".][^'"]*)['"]/g)) {
    const spec = m[1];
    if (spec.startsWith("node:") || spec.startsWith("@eval-kit/")) continue;
    const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    bareImports.add(pkg);
  }
}
for (const pkg of bareImports) {
  if (paths[pkg]) continue;
  try {
    const pkgJson = require.resolve(`${pkg}/package.json`, { paths: candidateModDirs });
    const pkgDir = dirname(pkgJson);
    paths[pkg] = [pkgDir];
    paths[`${pkg}/*`] = [join(pkgDir, "*")];
  } catch { /* let tsc report the missing module */ }
}

const tsconfig = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "bundler",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    jsx: "react-jsx",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    noEmit: true,
    baseUrl: repoRoot,
    paths,
    typeRoots,
  },
  files: extracted.map((e) => e.tsFile),
};
writeFileSync(join(tmpDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

console.log(`\nTypechecking ${count} block(s) against built monorepo types...\n`);
const tc = spawnSync("npx", ["tsc", "-p", "tsconfig.json"], { cwd: tmpDir, encoding: "utf8" });
const output = (tc.stdout ?? "") + (tc.stderr ?? "");

if (tc.status === 0) {
  for (const e of extracted) console.log(`  ✓ ${e.file}:${e.startLine}`);
  console.log("\nreadme-check: OK — every checked block compiles\n");
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(0);
}

// Map tsc diagnostics (which reference the temp file names) back to README locations.
console.error("readme-check: FAILED — one or more checked blocks do not compile:\n");
let remapped = output;
for (const e of extracted) remapped = remapped.split(e.tsFile).join(`${e.file}:${e.startLine} [block]`);
console.error(remapped);
rmSync(tmpDir, { recursive: true, force: true });
process.exit(1);
