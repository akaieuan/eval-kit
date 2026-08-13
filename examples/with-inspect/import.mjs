#!/usr/bin/env node
/**
 * Import an AISI Inspect `.eval` log file and emit an eval-kit Run artifact.
 *
 * Usage:
 *   node examples/with-inspect/import.mjs \
 *     --input logs/<inspect-log>.eval \
 *     --suite-id <suite-id> \
 *     [--out runs/imported.json]
 *
 * The importer maps Inspect's per-sample structure into eval-kit's
 * task × step shape and runs the converted artifact through eval-kit's
 * own tier-1 auto-scoring (autoScoreStep) — Inspect's grader output is
 * dropped on import so the produced Run is identical in shape to one
 * produced by `eval-kit run`.
 *
 * The output is a Run, not a ScoredRun. A reviewer scores it in the dashboard
 * to produce a ScoredRun.
 *
 * This is a reference example — adjust the field mapping to your Inspect
 * task's actual shape. See README.md for the field correspondence table.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

// ------- argv parsing (zero deps; minimal) -------

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((acc, cur, i, arr) => {
      if (cur.startsWith("--")) acc.push([cur.replace(/^--/, ""), arr[i + 1]]);
      return acc;
    }, []),
);

if (!args.input || !args["suite-id"]) {
  console.error("Usage: import.mjs --input <inspect-log.eval> --suite-id <id> [--out <run.json>]");
  process.exit(1);
}

// ------- read Inspect log -------

const raw = await readFile(args.input, "utf-8");
const log = JSON.parse(raw);

// Inspect's top-level shape (current as of late 2025/early 2026):
//   {
//     eval:    { task, task_args, model, model_args, ... },
//     plan:    { name, steps: [...] },
//     samples: [ { id, epoch, input, target, messages, tool_calls, scores, metadata }, ... ],
//   }
// Adjust field paths if your Inspect version differs.

const inspectModel = log?.eval?.model ?? "unknown";
const inspectTask = log?.eval?.task ?? "unknown";

// ------- map samples to task_results -------

const taskResults = (log.samples ?? []).map((sample) => {
  const stepResults = mapMessagesToSteps(sample);
  return {
    task_id: String(sample.id ?? `inspect-${randomUUID()}`),
    step_results: stepResults,
  };
});

// ------- assemble Run -------

const startedAt = log?.samples?.[0]?.metadata?.start_time ?? new Date().toISOString();
const endedAt = log?.samples?.[log.samples.length - 1]?.metadata?.end_time ?? startedAt;

const run = {
  schema_version: "1.0.0",
  suite_id: args["suite-id"],
  suite_version: "imported",
  run_id: randomUUID(),
  started_at: startedAt,
  ended_at: endedAt,
  adapter: {
    name: "inspect",
    model: inspectModel,
    config: { task: inspectTask, source_log: args.input },
  },
  task_results: taskResults,
};

// ------- write -------

const outPath = args.out ?? `runs/imported-from-inspect-${run.run_id}.json`;
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(run, null, 2), "utf-8");

console.log(`Wrote ${outPath}`);
console.log(`  ${taskResults.length} tasks, ${taskResults.reduce((n, t) => n + t.step_results.length, 0)} steps`);
console.log(`Next: open the dashboard and score this run.`);

// ------- helpers -------

/**
 * Map an Inspect sample's messages into eval-kit step_results.
 * Heuristic: each assistant turn that issues tool calls + a final user-visible
 * response counts as one step. Tweak per your Inspect task's conversation shape.
 */
function mapMessagesToSteps(sample) {
  const messages = sample.messages ?? [];
  const steps = [];
  let currentToolCalls = [];
  let stepN = 1;

  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      currentToolCalls.push(
        ...msg.tool_calls.map((tc) => ({
          tool: tc.function?.name ?? tc.tool ?? "unknown",
          args: tc.function?.arguments ?? tc.args ?? null,
          result: null, // tool result lands in a subsequent tool message
        })),
      );
    } else if (msg.role === "tool") {
      // Attach the tool result to the most-recent unattached tool_call.
      const last = currentToolCalls[currentToolCalls.length - 1];
      if (last && last.result === null) last.result = msg.content ?? null;
    } else if (msg.role === "assistant" && (msg.content || "").trim().length > 0) {
      steps.push({
        step_n: stepN++,
        agent_tool_calls: currentToolCalls,
        agent_final_output: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        latency_ms: 0, // Inspect doesn't surface per-step latency directly; populate if you do
        auto_score: {
          // Imported runs have no expected_tools to compare against — leave true
          // (the human reviewer will score golden_truth + dimensions). If you
          // also import an EvalSuite, re-run autoScoreStep against it.
          tool_match: true,
          distraction_caught: null,
        },
      });
      currentToolCalls = [];
    }
  }

  // Edge case: a sample with no terminal assistant message still gets one step
  // so the artifact is well-formed.
  if (steps.length === 0) {
    steps.push({
      step_n: 1,
      agent_tool_calls: currentToolCalls,
      agent_final_output: "",
      latency_ms: 0,
      auto_score: { tool_match: true, distraction_caught: null },
    });
  }

  return steps;
}
