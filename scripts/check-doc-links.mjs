#!/usr/bin/env node
// @ts-check
/*
 * check-doc-links — fail when a documentation link points at something that isn't there.
 *
 * Nothing in this repo checked doc links, which is how fourteen references to a `schemas/`
 * directory that was never created reached four docs at once — including one asserting that
 * reviewers "can see the contract without running the build". A doc that confidently links to
 * a missing file is the same failure this project exists to name: an instrument reporting a
 * success it cannot see.
 *
 * Scope is deliberate:
 *   - Only RELATIVE markdown links. External URLs need the network and would make the gate
 *     flaky; anchors-within-a-page need a heading parser and a stricter slug contract than the
 *     house style currently keeps.
 *   - Fenced code blocks are skipped. Links inside them are illustrations, not claims.
 *   - Files are taken from git (tracked + untracked-but-not-ignored), so work-in-progress docs
 *     are checked before they land, while gitignored scratch (`.superpowers/sdd/`) is not.
 *     In CI only tracked files exist, so this is tracked-only there.
 *
 * A link to a path that exists but is UNTRACKED is reported separately: it resolves on the
 * author's machine and 404s in a clone, which is the harder version of the same bug.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

/** Run git and return trimmed stdout lines, or exit on failure. */
function git(args) {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`check-doc-links: git ${args.join(" ")} failed`);
    process.exit(1);
  }
  return r.stdout.split("\n").filter(Boolean);
}

const markdown = git(["ls-files", "--cached", "--others", "--exclude-standard", "*.md"]);
const tracked = new Set(git(["ls-files"]));

/** Strip fenced code blocks so example links aren't treated as claims. */
function stripFences(text) {
  let inFence = false;
  return text
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return "";
      }
      return inFence ? "" : line;
    })
    .join("\n");
}

const LINK = /\[(?:[^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const EXTERNAL = /^(https?:|mailto:|tel:|#|<)/;

const missing = [];
const untrackedTargets = [];

for (const file of markdown) {
  const abs = join(repoRoot, file);
  if (!existsSync(abs)) continue; // deleted-but-listed
  const body = stripFences(readFileSync(abs, "utf8"));
  const lines = body.split("\n");

  lines.forEach((line, i) => {
    for (const m of line.matchAll(LINK)) {
      const raw = m[1];
      if (!raw || EXTERNAL.test(raw)) continue;

      // Drop anchor / query; decode %20 etc.
      const bare = decodeURIComponent(raw.split("#")[0].split("?")[0]);
      if (bare === "") continue; // pure in-page anchor

      const targetAbs = resolve(dirname(abs), bare);
      const targetRel = relative(repoRoot, targetAbs).split("\\").join("/");
      const where = { file, line: i + 1, link: raw };

      if (!existsSync(targetAbs)) {
        missing.push({ ...where, target: targetRel });
      } else if (
        // A directory is "tracked" if git tracks anything inside it.
        !tracked.has(targetRel) &&
        ![...tracked].some((t) => t.startsWith(targetRel + "/"))
      ) {
        untrackedTargets.push({ ...where, target: targetRel });
      }
    }
  });
}

const report = (rows) => {
  let last = "";
  for (const r of rows) {
    if (r.file !== last) {
      console.error(`\n  ${r.file}`);
      last = r.file;
    }
    console.error(`    line ${String(r.line).padEnd(4)} ${r.link}  ->  ${r.target}`);
  }
};

let failed = false;

if (missing.length) {
  failed = true;
  console.error(`\ncheck-doc-links: FAILED — ${missing.length} link(s) point at paths that do not exist:`);
  report(missing);
}

if (untrackedTargets.length) {
  failed = true;
  console.error(
    `\ncheck-doc-links: FAILED — ${untrackedTargets.length} link(s) resolve locally but are NOT tracked by git,` +
      `\nso they resolve for you and 404 in a clone:`,
  );
  report(untrackedTargets);
  console.error("\n  Commit the target, or drop the link.");
}

if (failed) {
  console.error(`\nScanned ${markdown.length} markdown file(s).\n`);
  process.exit(1);
}

console.log(`\ncheck-doc-links: OK — every relative link in ${markdown.length} markdown file(s) resolves\n`);
