#!/usr/bin/env node
/**
 * Import an OpenAI evals JSONL log and emit an eval-kit Run artifact.
 *
 * Usage:
 *   node examples/with-openai-evals/import.mjs \
 *     --input /tmp/evallogs/<eval-log>.jsonl \
 *     --suite-id <suite-id> \
 *     [--out runs/imported.json]
 *
 * OpenAI evals emits a JSONL stream with one record per event. The importer:
 *   1. Streams the JSONL line-by-line.
 *   2. Groups records by `sample_id`.
 *   3. Picks the "spec" record for run-level metadata and the "sampling"
 *      records for per-sample agent output.
 *   4. Emits a Run with one task per sample, one step per sample.
 *
 * The output is a Run, not a ScoredRun. A reviewer scores it in the dashboard
 * to produce a ScoredRun.
 *
 * This is a reference example — adjust the field mapping to your OpenAI evals
 * version (the event shape has evolved). See README.md for the correspondence.
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

// ------- argv parsing -------

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((acc, cur, i, arr) => {
      if (cur.startsWith("--")) acc.push([cur.replace(/^--/, ""), arr[i + 1]]);
      return acc;
    }, []),
);

if (!args.input || !args["suite-id"]) {
  console.error("Usage: import.mjs --input <log.jsonl> --suite-id <id> [--out <run.json>]");
  process.exit(1);
}

// ------- stream-read JSONL, group by sample_id -------

let spec = null;
const samples = new Map();

const rl = createInterface({
  input: createReadStream(args.input, { encoding: "utf-8" }),
  crlfDelay: Infinity,
});

let firstTimestamp = null;
let lastTimestamp = null;

for await (const line of rl) {
  if (!line.trim()) continue;
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    continue;
  }

  const created = record.created_at ?? record.timestamp;
  if (created) {
    firstTimestamp ??= created;
    lastTimestamp = created;
  }

  if (record.spec) {
    spec = record.spec;
    continue;
  }

  const sampleId = record.sample_id ?? record.spec?.sample_id;
  if (!sampleId) continue;

  if (!samples.has(sampleId)) samples.set(sampleId, []);
  samples.get(sampleId).push(record);
}

if (!spec) {
  console.error("No spec record found in JSONL — is this an OpenAI evals log?");
  process.exit(1);
}

// ------- map samples to task_results -------

const taskResults = [];
for (const [sampleId, records] of samples) {
  const samplingRecord = records.find((r) => r.type === "sampling" || r.sampling);
  const sampled = samplingRecord?.data?.sampled ?? samplingRecord?.sampling?.sampled ?? "";
  const sampledText = Array.isArray(sampled) ? sampled.join("\n") : String(sampled);

  taskResults.push({
    task_id: String(sampleId),
    step_results: [
      {
        step_n: 1,
        agent_tool_calls: extractToolCalls(sampledText),
        agent_final_output: sampledText,
        latency_ms: 0, // OpenAI evals doesn't surface per-sample latency at this level
        auto_score: {
          // Without an EvalSuite to compare against, tier-1 cannot judge
          // tool_match — leave true and let the reviewer's verdict be the
          // source of truth. If you also load an EvalSuite, re-run autoScoreStep.
          tool_match: true,
          distraction_caught: null,
        },
      },
    ],
  });
}

// ------- assemble Run -------

const run = {
  schema_version: "1.0.0",
  suite_id: args["suite-id"],
  suite_version: "imported",
  run_id: randomUUID(),
  started_at: firstTimestamp ?? new Date().toISOString(),
  ended_at: lastTimestamp ?? firstTimestamp ?? new Date().toISOString(),
  adapter: {
    name: "openai-evals",
    model: spec.model_name ?? spec.completion_fns?.[0] ?? "unknown",
    config: {
      openai_eval_name: spec.eval_name ?? null,
      openai_evals_run_id: spec.run_id ?? null,
      source_log: args.input,
    },
  },
  task_results: taskResults,
};

// ------- write -------

const outPath = args.out ?? `runs/imported-from-openai-evals-${run.run_id}.json`;
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(run, null, 2), "utf-8");

console.log(`Wrote ${outPath}`);
console.log(`  ${taskResults.length} samples mapped to tasks`);
console.log(`Next: open the dashboard and score this run.`);

// ------- helpers -------

/**
 * If the sampled text contains a JSON tool_calls block, pull it out as
 * structured agent_tool_calls. Otherwise return an empty array.
 *
 * This heuristic catches function-calling-style outputs that OpenAI evals
 * emits as raw JSON in the sampled field. It is intentionally cheap — if
 * your eval has a different convention, swap this for a richer parser.
 */
function extractToolCalls(text) {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.tool_calls)) {
      return parsed.tool_calls.map((tc) => ({
        tool: tc.function?.name ?? tc.tool ?? tc.name ?? "unknown",
        args: tc.function?.arguments ?? tc.args ?? tc.arguments ?? null,
        result: tc.result ?? null,
      }));
    }
  } catch {
    // not JSON; that's fine
  }
  return [];
}
