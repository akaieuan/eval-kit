#!/usr/bin/env node
// @ts-check
/*
 * verify:goldens — replay recorded runs through the live scoring path and check
 * them against human labels.
 *
 * For each `goldens/<name>/` it loads the frozen suite and the recorded run,
 * throws away the `auto_score` the run was recorded with, RE-SCORES every
 * labeled step from the raw evidence (tool calls, final output, gate events)
 * using the exact functions `runSuite` calls, and diffs the result against
 * `expected.json`.
 *
 * It never reads the recorded `auto_score`. Comparing the scorer against a
 * number the scorer itself wrote would only prove the implementation agrees
 * with itself — the same reason labels must be hand-authored (goldens/README.md).
 *
 * Zero network, zero API keys. Requires `pnpm build` (it imports the built core,
 * which is what ships).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const goldensDir = join(repoRoot, "goldens");

// ---- load the built core -----------------------------------------------------------
const distIndex = join(repoRoot, "packages/core/dist/index.js");
const distLoader = join(repoRoot, "packages/core/dist/loader.js");
for (const f of [distIndex, distLoader]) {
  if (!existsSync(f)) {
    console.error(`verify:goldens: ${f} is missing — run \`pnpm build\` first.`);
    process.exit(1);
  }
}
const { scoreStep, gateCallsFromEvents } = await import(pathToFileURL(distIndex).href);
const { loadSuite, loadRun } = await import(pathToFileURL(distLoader).href);

// ---- comparison --------------------------------------------------------------------

/**
 * The shape labels are written in: an `AutoScore` with one projection —
 * `verification.findings` becomes a COUNT. A human labels how many
 * machine-checkable issues an output deserves, not the verifier's exact wording;
 * asserting message strings would couple the corpus to implementation copy.
 */
function projectable(auto) {
  return {
    tool_match: auto.tool_match,
    distraction_caught: auto.distraction_caught,
    distraction_acted: auto.distraction_acted,
    gates: {
      mandated: auto.gates.mandated,
      discretionary: auto.gates.discretionary,
    },
    verification:
      auto.verification === null
        ? null
        : { passed: auto.verification.passed, findings: auto.verification.findings.length },
  };
}

/**
 * JSON.stringify with object keys sorted (recursively), so two objects that
 * differ only in key order serialize identically. Used to compare array
 * elements by content instead of by `String()`, which collapses every plain
 * object to the literal string `"[object Object]"` — meaning an array of
 * objects previously compared by LENGTH ONLY and every element looked alike.
 */
function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/** Arrays compare as sets — label order must not matter, but element CONTENT does. */
function equal(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    const [sa, sb] = [[...a].map(stableStringify).sort(), [...b].map(stableStringify).sort()];
    return sa.every((v, i) => v === sb[i]);
  }
  return a === b;
}

/**
 * Deep PARTIAL match: only keys the label asserts are checked. A labeler should
 * assert what they actually judged and stay silent on the rest, rather than be
 * pushed into hand-computing fields they have no opinion about.
 */
function diff(expected, actual, path, out) {
  const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  if (!isPlainObject(expected)) {
    if (!equal(expected, actual)) out.push({ path, expected, actual });
    return out;
  }
  if (!isPlainObject(actual)) {
    out.push({ path, expected, actual });
    return out;
  }
  for (const key of Object.keys(expected)) {
    diff(expected[key], actual[key], path ? `${path}.${key}` : key, out);
  }
  return out;
}

// ---- discovery ---------------------------------------------------------------------
if (!existsSync(goldensDir)) {
  console.error("verify:goldens: no goldens/ directory.");
  process.exit(1);
}

/** @type {string[]} */
const problems = [];
const dirs = readdirSync(goldensDir)
  .filter((n) => statSync(join(goldensDir, n)).isDirectory())
  .sort();
const goldens = dirs.filter((n) => existsSync(join(goldensDir, n, "expected.json")));
for (const n of dirs) {
  if (!goldens.includes(n)) {
    problems.push(`goldens/${n}: no expected.json — a recording without labels is not a golden.`);
  }
}
if (goldens.length === 0) {
  console.error("verify:goldens: goldens/ contains no labeled goldens — nothing was verified.");
  process.exit(1);
}

// ---- replay ------------------------------------------------------------------------
console.log(
  `verify:goldens — re-scoring ${goldens.length} golden${goldens.length === 1 ? "" : "s"} through the live scoring path\n`,
);

let labelCount = 0;
let mismatchCount = 0;

for (const name of goldens) {
  const dir = join(goldensDir, name);
  const rel = `goldens/${name}`;
  /** @type {any} */
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8"));
  } catch (err) {
    problems.push(`${rel}: expected.json is not valid JSON — ${err.message}`);
    continue;
  }

  if (typeof spec.labeled_by !== "string" || spec.labeled_by.trim() === "") {
    problems.push(`${rel}: expected.json has no \`labeled_by\` — labels need an author.`);
  }
  if (!Array.isArray(spec.labels) || spec.labels.length === 0) {
    problems.push(`${rel}: expected.json has no labels — nothing to verify.`);
    continue;
  }

  let suite;
  let run;
  try {
    suite = await loadSuite(join(dir, spec.suite ?? "suite.yaml"));
    run = await loadRun(join(dir, spec.run ?? "run.json"));
  } catch (err) {
    problems.push(`${rel}: could not load the golden — ${err.message}`);
    continue;
  }

  const suiteTasks = new Map(suite.suite.tasks.map((t) => [t.id, t]));
  const recorded = new Map(
    run.task_results.map((t) => [t.task_id, new Map(t.step_results.map((s) => [s.step_n, s]))]),
  );
  const recordedSteps = run.task_results.reduce((n, t) => n + t.step_results.length, 0);

  console.log(`${rel}  (${spec.labels.length} of ${recordedSteps} recorded steps labeled)`);

  for (const label of spec.labels) {
    labelCount += 1;
    const where = `${label.task_id} step ${label.step_n}`;

    if (typeof label.why !== "string" || label.why.trim() === "") {
      problems.push(`${rel}: ${where} has no \`why\` — a label without a stated reason is not judgement.`);
      console.log(`  FAIL ${where}  (no \`why\`)`);
      mismatchCount += 1;
      continue;
    }

    const task = suiteTasks.get(label.task_id);
    const step = task?.steps.find((s) => s.n === label.step_n);
    const stepResult = recorded.get(label.task_id)?.get(label.step_n);
    if (!task || !step || !stepResult) {
      problems.push(
        `${rel}: ${where} is labeled but ${!task || !step ? "absent from the suite" : "absent from the run"}.`,
      );
      console.log(`  FAIL ${where}  (no such step)`);
      mismatchCount += 1;
      continue;
    }

    let actual;
    try {
      actual = projectable(
        scoreStep({
          step,
          task,
          toolsCalled: stepResult.agent_tool_calls.map((c) => c.tool),
          finalOutput: stepResult.agent_final_output,
          gateCalls: gateCallsFromEvents(stepResult.gate_events),
        }),
      );
    } catch (err) {
      problems.push(`${rel}: ${where} could not be re-scored — ${err.message}`);
      console.log(`  FAIL ${where}  (not replayable)`);
      mismatchCount += 1;
      continue;
    }

    const found = diff(label.expect ?? {}, actual, "", []);
    if (found.length === 0) {
      console.log(`  ok   ${where}`);
      continue;
    }
    mismatchCount += 1;
    console.log(`  FAIL ${where}`);
    const width = Math.max(...found.map((f) => f.path.length));
    for (const f of found) {
      console.log(
        `       ${f.path.padEnd(width)}  expected ${JSON.stringify(f.expected)}  actual ${JSON.stringify(f.actual)}`,
      );
    }
    console.log(`       why: ${label.why}`);
  }
  console.log("");
}

// ---- verdict -----------------------------------------------------------------------
for (const p of problems) console.error(`  · ${p}`);

const summary = `${goldens.length} golden${goldens.length === 1 ? "" : "s"}, ${labelCount} label${labelCount === 1 ? "" : "s"}, ${mismatchCount} mismatch${mismatchCount === 1 ? "" : "es"}`;
if (mismatchCount > 0 || problems.length > 0) {
  console.error(`\nverify:goldens: FAILED — ${summary}`);
  console.error(
    "\nA mismatch means the scorer no longer agrees with human judgement. Fix the scorer,\n" +
      "or change the label only if the judgement itself was wrong — never to match the code.\n",
  );
  process.exit(1);
}
console.log(`verify:goldens: OK — ${summary}\n`);
