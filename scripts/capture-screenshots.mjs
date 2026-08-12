#!/usr/bin/env node
/**
 * Auto-generates the README's dashboard screenshots.
 *
 * Usage:
 *   pnpm --filter @eval-kit/dashboard dev   # in one terminal
 *   node scripts/capture-screenshots.mjs    # in another — writes to docs/images/
 *
 * Uses Chrome's headless-screenshot CLI directly (no puppeteer dep). The
 * `--virtual-time-budget` flag tells Chrome to wait that many ms before
 * snapping the screenshot, which is enough for Next.js dev server's JIT
 * compile + initial client-side render to settle.
 *
 * Override the Chrome path with CHROME_PATH if you're not on the macOS
 * default install location.
 */

import { execFile } from "node:child_process";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(REPO_ROOT, "docs/images");
const BASE = process.env.DASHBOARD_URL ?? "http://localhost:3000";

/*
 * `/runs/[id]` needs a run id, so the review screen — the app's most
 * important surface, and a README image — was never regenerable by this
 * script. docs/images/review.png had been stale since 2026-04-23 while every
 * other capture moved. Resolve an id from runs/ so it refreshes with the rest.
 */
const runsDir = resolve(REPO_ROOT, "runs");
let reviewPath = null;
try {
  const preferred = "test-gates-bypass.json"; // shows a real gate violation
  const files = (await readdir(runsDir)).filter((f) => f.endsWith(".json"));
  const pick = files.includes(preferred) ? preferred : files[0];
  if (pick) {
    const run = JSON.parse(await readFile(resolve(runsDir, pick), "utf8"));
    if (run.run_id) reviewPath = `/runs/${run.run_id}`;
  }
} catch {
  /* leave null; reported below rather than silently skipped */
}

const ROUTES = [
  { path: "/", file: "overview.png" },
  { path: "/inbox", file: "inbox.png" },
  { path: "/runs", file: "runs.png" },
  { path: "/diff", file: "diff.png" },
  { path: "/agents", file: "agents.png" },
  ...(reviewPath ? [{ path: reviewPath, file: "review.png" }] : []),
];
if (!reviewPath) {
  process.stderr.write(
    "! no run artifact found — review.png will NOT be regenerated\n",
  );
}

await mkdir(OUT_DIR, { recursive: true });

/*
 * Chrome exits ZERO after rendering "This site can't be reached", and writes a
 * perfectly valid PNG of it. So the whole run once reported "Done — 6
 * screenshots" while committing six pictures of ERR_CONNECTION_REFUSED over
 * the real ones. The exit code proves Chrome ran, not that it photographed the
 * dashboard.
 *
 * Reachability is therefore checked here rather than inferred, and the
 * README's own thesis is the reason: an instrument that cannot see must not
 * report success.
 */
async function reachable(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    return res.ok ? null : `HTTP ${res.status}`;
  } catch (err) {
    return err.cause?.code ?? err.message;
  }
}

const baseFailure = await reachable(BASE);
if (baseFailure) {
  process.stderr.write(
    `✗ ${BASE} is not reachable (${baseFailure}).\n` +
      "  Start the dashboard first, or set DASHBOARD_URL to where it is listening.\n" +
      "  Refusing to run: Chrome would happily screenshot the error page instead.\n",
  );
  process.exit(1);
}

/** Captures that failed. A partial run must not look like a clean one. */
const failures = [];

for (const { path, file } of ROUTES) {
  const out = resolve(OUT_DIR, file);
  const url = `${BASE}${path}`;
  process.stdout.write(`→ ${url}  →  docs/images/${file}\n`);
  const unreachable = await reachable(url);
  if (unreachable) {
    process.stderr.write(`  failed: ${unreachable} — not captured\n`);
    failures.push(file);
    continue;
  }
  try {
    const { stdout } = await exec(CHROME, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=1600,1000",
      "--virtual-time-budget=10000",
      `--screenshot=${out}`,
      url,
    ]);
    if (stdout.includes("bytes written")) {
      process.stdout.write(`  ${stdout.trim().split("\n").pop()}\n`);
    }
  } catch (err) {
    process.stderr.write(`  failed: ${err.message}\n`);
    failures.push(file);
  }
}

if (failures.length > 0) {
  process.stderr.write(
    `\n\u2717 ${failures.length} capture(s) failed: ${failures.join(", ")}\n` +
      "  Exiting non-zero — a silent partial capture reads as a clean run.\n",
  );
  process.exit(1);
}
process.stdout.write(`\nDone — ${ROUTES.length} screenshots in docs/images/\n`);
