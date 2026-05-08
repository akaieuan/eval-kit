/**
 * End-to-end example: run a real eval suite against the Anthropic adapter.
 *
 * Usage:
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   pnpm tsx examples/run-against-anthropic.ts
 *
 * What it does:
 *   1. Loads the `research-agent-v1` seed suite from @eval-kit/seed-suite
 *   2. Creates an Anthropic adapter (claude-sonnet-4-5, tool-use loop, prompt caching)
 *   3. Runs the suite end-to-end — the adapter calls Claude per step, with
 *      simulated tool results (the eval is measuring tool *selection*, not
 *      tool execution; real tool calls are fed mocked results so the
 *      step's tool_match auto-score is well-defined).
 *   4. Auto-scores every step at trace time (tier-1: tool_match + distraction_caught)
 *   5. Writes runs/<date>-anthropic.json so you can open it in the dashboard
 *      (`pnpm --filter @eval-kit/dashboard dev`) and human-score the steps.
 *
 * Cost: this runs the full ~10-task seed suite end-to-end against
 * claude-sonnet-4-5. Expect ~$1-2 of API spend per run with default settings.
 * Lower the cost by using `--filter` on a subset of tasks, or by switching
 * to claude-haiku via opts.model.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAnthropicAdapter, runSuite } from "@eval-kit/core";
import { loadSuite } from "@eval-kit/core/loader";
import { researchAgentV1Path } from "@eval-kit/seed-suite";

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Export it first:\n" +
        "  export ANTHROPIC_API_KEY=sk-ant-...",
    );
    process.exit(1);
  }

  const suite = await loadSuite(researchAgentV1Path);
  const adapter = createAnthropicAdapter({
    model: "claude-sonnet-4-5",
    // Anthropic adapter applies prompt caching on system + tool block by default.
    // Override system prompt or maxToolIterations here if needed.
  });

  console.log(
    `Running ${suite.suite.id}@${suite.suite.version} (${suite.suite.tasks.length} tasks) against ${adapter.name}/${adapter.model}…`,
  );

  const run = await runSuite(suite, { adapter });

  const outDir = resolve(process.cwd(), "runs");
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(
    outDir,
    `${run.started_at.slice(0, 10)}-anthropic.json`,
  );
  await writeFile(outPath, JSON.stringify(run, null, 2));

  // Print a brief summary so you can see what happened without opening the JSON.
  const totalSteps = run.task_results.reduce(
    (n, t) => n + t.step_results.length,
    0,
  );
  const toolMatchPass = run.task_results.reduce(
    (n, t) =>
      n +
      t.step_results.filter((s) => s.auto_score?.tool_match === true).length,
    0,
  );

  console.log(`\nDone — wrote ${outPath}`);
  console.log(
    `Tier-1 auto-score: ${toolMatchPass}/${totalSteps} steps tool_match=true`,
  );
  console.log(
    "Open the dashboard to human-score the run:\n" +
      "  pnpm --filter @eval-kit/dashboard dev\n" +
      "  → http://localhost:3000",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
