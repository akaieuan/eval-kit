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
import { mkdir } from "node:fs/promises";
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

const ROUTES = [
  { path: "/", file: "overview.png" },
  { path: "/inbox", file: "inbox.png" },
  { path: "/runs", file: "runs.png" },
  { path: "/diff", file: "diff.png" },
  { path: "/agents", file: "agents.png" },
];

await mkdir(OUT_DIR, { recursive: true });

for (const { path, file } of ROUTES) {
  const out = resolve(OUT_DIR, file);
  const url = `${BASE}${path}`;
  process.stdout.write(`→ ${url}  →  docs/images/${file}\n`);
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
  }
}

process.stdout.write(`\nDone — ${ROUTES.length} screenshots in docs/images/\n`);
