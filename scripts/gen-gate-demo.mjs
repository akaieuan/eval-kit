#!/usr/bin/env node
// @ts-check
/*
 * gen:gate-demo — regenerate the two gate demo artifacts.
 *
 *   runs/test-gates-honored.json — honor mode: a blanket approval precedes
 *     every gated call, and the policy-gap prompt draws an `ask_user` that
 *     matches its declared blocker.
 *   runs/test-gates-bypass.json  — the default mock: the same task tools, the
 *     same outputs, and no gate calls at all.
 *
 * Diff the pair and every tool_match is identical — the runs differ ONLY in
 * whether authorization happened. That is the demo the dashboard renders, and
 * the reason gate scores cannot be derived from output quality.
 *
 * Deterministic (mock adapter, frozen suite). Zero network. Requires
 * `pnpm build` — it imports the built core, which is what ships.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const distIndex = join(repoRoot, "packages/core/dist/index.js");
const distLoader = join(repoRoot, "packages/core/dist/loader.js");
for (const f of [distIndex, distLoader]) {
  if (!existsSync(f)) {
    console.error(`gen:gate-demo: ${f} is missing — run \`pnpm build\` first.`);
    process.exit(1);
  }
}

const { createMockAdapter, runSuite } = await import(pathToFileURL(distIndex).href);
const { loadSuite } = await import(pathToFileURL(distLoader).href);

const suitePath = join(repoRoot, "packages/seed-suite/suites/support-agent-v1.yaml");
const outDir = join(repoRoot, "runs");

const suite = await loadSuite(suitePath);
await mkdir(outDir, { recursive: true });

/** @type {{file: string, opts: Record<string, unknown>}[]} */
const VARIANTS = [
  {
    file: "test-gates-honored.json",
    opts: {
      model: "mock-gates-honored",
      gateBehavior: "honor",
      askOn: /refer/i, // fires only on the policy-gap prompt (task-004)
    },
  },
  {
    file: "test-gates-bypass.json",
    opts: { model: "mock-gates-bypass" },
  },
];

for (const { file, opts } of VARIANTS) {
  const run = await runSuite(suite, { adapter: createMockAdapter(opts) });
  const out = join(outDir, file);
  await writeFile(out, JSON.stringify(run, null, 2));

  let required = 0;
  let honored = 0;
  let violated = 0;
  let asked = 0;
  let matched = 0;
  for (const t of run.task_results) {
    for (const s of t.step_results) {
      const m = s.auto_score.gates.mandated;
      if (m) {
        required += m.required.length;
        honored += m.honored.length;
        violated += m.violated.length;
      }
      const d = s.auto_score.gates.discretionary;
      if (d) {
        asked += d.asked;
        matched += d.matched;
      }
    }
  }
  console.log(
    `→ runs/${file}  gates ${honored}/${required} honored, ${violated} violated · asks ${matched}/${asked} matched`,
  );
}

console.log("\nDone. Diff the two to see gate deltas with identical tool_match.");
