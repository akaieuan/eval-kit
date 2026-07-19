#!/usr/bin/env node
// @ts-check
/*
 * publish-smoke — honest "does the PUBLISHED artifact work outside the monorepo?" harness.
 *
 * What it proves, from the point of view of a stranger about to `npm install` these packages:
 *   1. `pnpm build` produces dist output for every publishable package.
 *   2. `pnpm pack` (the exact command the release workflow publishes with — it resolves
 *      `workspace:*` to concrete versions, which `npm pack` does NOT) yields installable tarballs.
 *   3. A scratch consumer project OUTSIDE this repo (os.tmpdir) can `npm install` those tarballs
 *      via `file:` specifiers. Cross-package eval-kit deps are pinned to the TARBALLS via npm
 *      `overrides` (so @eval-kit/ui's dependency on @eval-kit/core resolves to our freshly-built
 *      tarball, never the public registry). External deps (react, radix, @anthropic-ai/sdk, ...)
 *      install from the real npm registry on purpose — that chain is part of the test.
 *   4. Every subpath in each package's `exports` map imports at runtime (CSS subpaths are
 *      resolution-checked, since Node can't `import` a stylesheet).
 *   5. The same subpaths typecheck under BOTH `moduleResolution: bundler` AND `node16`.
 *   6. The `bin` (core's `eval-kit`) executes with `--help` and exits 0.
 *   7. `@arethetypeswrong/cli --pack` passes on every tarball.
 *
 * attw policy (documented + justified, per requirement):
 *   All three packages are ESM-only (`"type":"module"`, tsup `format:["esm"]`). We run attw with
 *   `--profile esm-only`, which scopes analysis to the ESM/bundler resolution modes and ignores the
 *   CJS-consumer rules (`cjs-resolves-to-esm`, legacy node10 subpath resolution). Those "failures"
 *   are the CORRECT behaviour for a package that deliberately ships no CommonJS entry — a CJS caller
 *   must use dynamic `import()`. We do NOT globally ignore `no-resolution`; the esm-only profile only
 *   suppresses it for the CJS/node10 profiles, so a genuinely-missing ESM/bundler entry still fails.
 *   For @eval-kit/ui we additionally `--exclude-entrypoints ./styles.css`: that export points at a raw
 *   CSS file, which attw cannot analyze as a JS/types module (it reports NoResolution for any CSS
 *   export). We instead prove that subpath resolves via `import.meta.resolve` in the runtime step.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

let failed = false;
const step = (msg) => console.log(`\n→ ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => { failed = true; console.error(`  ✗ ${msg}`); };

/** Run a command, inheriting stdio; throw on non-zero. */
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited ${r.status}`);
}
/** Run a command, capture output, return { status, stdout, stderr }. */
function runCapture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const tarballName = (name) => name.replace(/^@/, "").replace(/\//g, "-");

// ---- discover publishable packages ------------------------------------------------
step("Discovering publishable packages");
const pkgsDir = join(repoRoot, "packages");
const publishable = [];
for (const entry of readdirSync(pkgsDir)) {
  const pjPath = join(pkgsDir, entry, "package.json");
  if (!existsSync(pjPath)) continue;
  const pj = JSON.parse(readFileSync(pjPath, "utf8"));
  if (pj.private === true) { ok(`skip ${pj.name} (private)`); continue; }
  publishable.push({ dir: join(pkgsDir, entry), pj });
  ok(`publishable: ${pj.name}@${pj.version}`);
}
if (publishable.length === 0) { bad("no publishable packages found"); process.exit(1); }

// ---- build ------------------------------------------------------------------------
step("pnpm build");
run("pnpm", ["build"], { cwd: repoRoot });

// ---- pack -------------------------------------------------------------------------
step("pnpm pack (resolves workspace:* like the release pipeline)");
const packDir = mkdtempSync(join(tmpdir(), "eval-kit-pack-"));
const tarballs = {}; // name -> abs path
for (const { dir, pj } of publishable) {
  run("pnpm", ["pack", "--pack-destination", packDir], { cwd: dir });
  const prefix = `${tarballName(pj.name)}-`;
  const file = readdirSync(packDir).find((f) => f.startsWith(prefix) && f.endsWith(".tgz"));
  if (!file) { bad(`no tarball produced for ${pj.name}`); continue; }
  tarballs[pj.name] = join(packDir, file);
  ok(`packed ${pj.name} -> ${file}`);
}

// ---- scratch consumer OUTSIDE the repo --------------------------------------------
step("Creating scratch consumer project outside the monorepo");
const consumer = mkdtempSync(join(tmpdir(), "eval-kit-consumer-"));
const needsReact = publishable.some(({ pj }) => pj.peerDependencies && pj.peerDependencies.react);

const consumerDeps = { ...Object.fromEntries(Object.entries(tarballs).map(([n, p]) => [n, `file:${p}`])) };
if (needsReact) { consumerDeps.react = "^19.0.0"; consumerDeps["react-dom"] = "^19.0.0"; }
const overrides = Object.fromEntries(Object.entries(tarballs).map(([n, p]) => [n, `file:${p}`]));
const consumerPj = {
  name: "eval-kit-publish-smoke-consumer",
  version: "1.0.0",
  private: true,
  type: "module",
  dependencies: consumerDeps,
  devDependencies: {
    typescript: "^5.7.3",
    "@types/node": "^22.10.5",
    ...(needsReact ? { "@types/react": "^19.0.2", "@types/react-dom": "^19.0.2" } : {}),
  },
  overrides, // force cross-package eval-kit deps to resolve to the TARBALLS, not the registry
};
writeFileSync(join(consumer, "package.json"), JSON.stringify(consumerPj, null, 2));
ok(`consumer at ${consumer}`);

step("npm install (external deps come from the real registry on purpose)");
run("npm", ["install", "--no-audit", "--no-fund"], { cwd: consumer });

// ---- build the subpath manifest from each exports map -----------------------------
/** @type {{spec:string, kind:'js'|'css', pkg:string}[]} */
const subpaths = [];
for (const { pj } of publishable) {
  const exportsMap = pj.exports ?? { ".": pj.main };
  for (const [key, val] of Object.entries(exportsMap)) {
    const target = typeof val === "string" ? val : (val.import ?? val.types ?? "");
    const spec = key === "." ? pj.name : `${pj.name}${key.slice(1)}`;
    subpaths.push({ spec, kind: target.endsWith(".css") ? "css" : "js", pkg: pj.name });
  }
}

// ---- runtime import of every subpath ----------------------------------------------
step("Runtime import of every exports subpath");
const runLines = [
  "const results = [];",
  "async function attempt(spec, kind) {",
  "  try {",
  "    if (kind === 'css') { const u = import.meta.resolve(spec); if (!u) throw new Error('no resolution'); results.push(['resolve', spec, '(css) ' + u.split('/').pop()]); }",
  "    else { const m = await import(spec); const keys = Object.keys(m); if (keys.length === 0) throw new Error('empty module'); results.push(['import', spec, keys.slice(0,3).join(', ') + (keys.length>3?', ...':'')]); }",
  "  } catch (e) { console.error('FAIL ' + spec + ': ' + (e && e.message)); process.exitCode = 1; }",
  "}",
];
for (const { spec, kind } of subpaths) runLines.push(`await attempt(${JSON.stringify(spec)}, ${JSON.stringify(kind)});`);
runLines.push("for (const [verb, spec, detail] of results) console.log('  ' + verb + ' ' + spec + ' -> ' + detail);");
writeFileSync(join(consumer, "run.mjs"), runLines.join("\n"));
const runRes = runCapture("node", ["run.mjs"], { cwd: consumer });
process.stdout.write(runRes.stdout);
if (runRes.status !== 0) { process.stderr.write(runRes.stderr); bad("runtime subpath import failed"); }
else ok(`imported ${subpaths.filter((s) => s.kind === "js").length} JS subpaths + resolved ${subpaths.filter((s) => s.kind === "css").length} CSS subpath(s)`);

// ---- typecheck usage file: bundler AND node16 -------------------------------------
step("Typecheck usage file (moduleResolution: bundler AND node16)");
// Discover real runtime symbols per JS subpath so the usage file exercises actual exports.
const symLines = ["import { pathToFileURL } from 'node:url';", "const out = {};"];
for (const { spec, kind } of subpaths) {
  if (kind !== "js") continue;
  symLines.push(`out[${JSON.stringify(spec)}] = Object.keys(await import(${JSON.stringify(spec)}));`);
}
symLines.push("process.stdout.write(JSON.stringify(out));");
writeFileSync(join(consumer, "symbols.mjs"), symLines.join("\n"));
const symRes = runCapture("node", ["symbols.mjs"], { cwd: consumer });
/** @type {Record<string,string[]>} */
let symbolMap = {};
try { symbolMap = JSON.parse(symRes.stdout || "{}"); } catch { /* handled below */ }

const usageLines = [];
let i = 0;
for (const { spec, kind } of subpaths) {
  if (kind !== "js") continue; // CSS can't be typechecked as a module; resolution proven at runtime
  const syms = (symbolMap[spec] ?? []).slice(0, 3);
  const alias = `m${i++}`;
  usageLines.push(`import * as ${alias} from ${JSON.stringify(spec)};`);
  for (const s of syms) usageLines.push(`void ${alias}[${JSON.stringify(s)}];`);
}
writeFileSync(join(consumer, "usage.ts"), usageLines.join("\n") + "\n");

const baseCompiler = {
  target: "ES2022",
  lib: ["ES2022", "DOM", "DOM.Iterable"],
  jsx: "react-jsx",
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  noEmit: true,
  types: ["node"],
};
for (const [name, module, moduleResolution] of [["bundler", "ESNext", "bundler"], ["node16", "node16", "node16"]]) {
  const tsconfig = { compilerOptions: { ...baseCompiler, module, moduleResolution }, files: ["usage.ts"] };
  writeFileSync(join(consumer, `tsconfig.${name}.json`), JSON.stringify(tsconfig, null, 2));
  const tc = runCapture("npx", ["tsc", "-p", `tsconfig.${name}.json`], { cwd: consumer });
  if (tc.status !== 0) { process.stdout.write(tc.stdout); process.stderr.write(tc.stderr); bad(`tsc failed (moduleResolution: ${name})`); }
  else ok(`tsc clean (moduleResolution: ${name})`);
}

// ---- execute the bin --------------------------------------------------------------
step("Execute installed CLI bin(s) with --help");
for (const { pj } of publishable) {
  if (!pj.bin) continue;
  const bins = typeof pj.bin === "string" ? { [pj.name]: pj.bin } : pj.bin;
  for (const [binName, binRel] of Object.entries(bins)) {
    const binPath = join(consumer, "node_modules", pj.name, binRel);
    const res = runCapture("node", [binPath, "--help"], { cwd: consumer });
    if (res.status !== 0) bad(`bin ${binName} --help exited ${res.status}`);
    else ok(`bin ${binName} --help exited 0`);
  }
}

// ---- arethetypeswrong --------------------------------------------------------------
step("arethetypeswrong (--profile esm-only)");
for (const { pj } of publishable) {
  const tgz = tarballs[pj.name];
  if (!tgz) continue;
  const args = ["--yes", "@arethetypeswrong/cli@0.18.5", "--pack", tgz, "--profile", "esm-only", "--format", "table"];
  // ui/styles.css is a raw CSS export attw can't analyze as a module — proven at runtime instead.
  if (pj.exports && Object.keys(pj.exports).some((k) => k.endsWith(".css"))) {
    const cssKey = Object.keys(pj.exports).find((k) => k.endsWith(".css"));
    args.push("--exclude-entrypoints", cssKey);
  }
  const res = runCapture("npx", args, { cwd: repoRoot });
  process.stdout.write(res.stdout);
  if (res.status !== 0) { process.stderr.write(res.stderr); bad(`attw reported problems for ${pj.name}`); }
  else ok(`attw clean for ${pj.name}`);
}

// ---- cleanup ----------------------------------------------------------------------
try { rmSync(packDir, { recursive: true, force: true }); rmSync(consumer, { recursive: true, force: true }); } catch { /* best effort */ }

if (failed) { console.error("\npublish-smoke: FAILED\n"); process.exit(1); }
console.log("\npublish-smoke: OK\n");
