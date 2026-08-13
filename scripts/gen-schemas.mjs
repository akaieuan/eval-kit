#!/usr/bin/env node
// @ts-check
/*
 * gen-schemas — emit the machine-readable protocol contract from the Zod source of truth.
 *
 * `docs/SCHEMA.md` is the narrative spec; these files are the contract a producer in any
 * language validates against. Zod in `packages/core/src/schema.ts` stays the single source
 * of truth — these are GENERATED, never hand-edited.
 *
 * The drift gate is the whole point. A generated artifact that is committed but unverified
 * becomes a second source of truth that lies: `docs/SCHEMA.md` promises reviewers can read
 * the contract without running the build, and that promise survives exactly until the first
 * un-regenerated Zod edit. So `--check` regenerates and then fails if the working tree
 * differs from what is committed.
 *
 * It checks with `git status --porcelain`, NOT `git diff --exit-code`: the latter only sees
 * modifications to files git already tracks, so a NEWLY generated schema file lands untracked
 * and the gate passes while the contract is missing. Note the same gotcha `api-surface.mjs`
 * has: a STAGED file is still dirty here, so regenerated output must be COMMITTED.
 *
 * Run `pnpm build` first — schemas are generated from `packages/core/dist`, so that the
 * contract is derived from what actually ships rather than from source that may not compile.
 *
 * Usage:  node scripts/gen-schemas.mjs [--check]
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outDir = join(repoRoot, "schemas", "v1");
const check = process.argv.includes("--check");

const distPath = join(repoRoot, "packages/core/dist/index.js");
if (!existsSync(distPath)) {
  console.error("gen-schemas: packages/core/dist not found — run `pnpm -r build` first.");
  process.exit(1);
}

const core = await import(pathToFileURL(distPath).href);
const { zodToJsonSchema } = await import(
  pathToFileURL(join(repoRoot, "packages/core/node_modules/zod-to-json-schema/dist/esm/index.js")).href
);

/**
 * The four artifacts that cross a process or language boundary. `EvalTask`, `EvalStep`,
 * `GateEvent` and friends are inlined into these rather than published separately: they are
 * never exchanged on their own, and a separate file would imply a stability promise the
 * project does not make for them.
 */
const ARTIFACTS = [
  {
    file: "eval-suite.schema.json",
    export: "EvalSuite",
    title: "eval-kit EvalSuite",
    description:
      "A suite of evaluation tasks, authored as YAML. Input to `eval-kit run`. See docs/SCHEMA.md.",
  },
  {
    file: "run.schema.json",
    export: "Run",
    title: "eval-kit Run",
    description:
      "The trace artifact a runner emits: every task, step, tool call and auto-score. Output of `eval-kit run`, input to human review. See docs/SCHEMA.md.",
  },
  {
    file: "step-score.schema.json",
    export: "StepScore",
    title: "eval-kit StepScore",
    description:
      "One reviewer's judgement of one step: golden truth, per-dimension rubric, notes. Produced in the dashboard, merged into a Run by `mergeScores`. See docs/SCHEMA.md.",
  },
  {
    file: "scored-run.schema.json",
    export: "ScoredRun",
    title: "eval-kit ScoredRun",
    description:
      "A Run with human StepScores attached. Input to `eval-kit diff`, the CI gate and the SFT/DPO exporters. See docs/SCHEMA.md.",
  },
];

/**
 * Recursively sort object keys so the output is byte-stable.
 *
 * zod-to-json-schema is deterministic today (verified: three consecutive generations are
 * byte-identical), but `api-surface.mjs` was bitten by a generator whose ordering drifted
 * run-to-run, and a drift gate that flakes gets disabled. Sorting removes the failure mode
 * rather than trusting it stays absent. Arrays keep their order — it is semantic in
 * `required`, `enum` and `anyOf`.
 */
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
    return out;
  }
  return value;
}

mkdirSync(outDir, { recursive: true });

const written = [];
for (const artifact of ARTIFACTS) {
  const zodSchema = core[artifact.export];
  if (!zodSchema || typeof zodSchema.safeParse !== "function") {
    console.error(`gen-schemas: @eval-kit/core does not export a Zod schema named ${artifact.export}`);
    process.exit(1);
  }

  const generated = zodToJsonSchema(zodSchema, { target: "jsonSchema7", $refStrategy: "none" });
  // zod-to-json-schema puts $schema on the body; we re-assert it alongside our own metadata.
  delete generated.$schema;

  const doc = {
    $schema: "http://json-schema.org/draft-07/schema#",
    // Relative $id on purpose: an absolute URL would assert a hosting location that does not
    // resolve, which is the same broken-reference failure the doc-link gate exists to catch.
    $id: artifact.file,
    title: artifact.title,
    description: artifact.description,
    "x-eval-kit": {
      schema_version: core.SCHEMA_VERSION,
      generated_from: `packages/core/src/schema.ts (${artifact.export})`,
      generator: "scripts/gen-schemas.mjs",
      warning: "GENERATED FILE — do not edit by hand. Change the Zod schema and run `pnpm schemas:build`.",
    },
    ...sortKeys(generated),
  };

  writeFileSync(join(outDir, artifact.file), JSON.stringify(doc, null, 2) + "\n");
  written.push(artifact.file);
  console.log(`  wrote schemas/v1/${artifact.file}  (${artifact.export})`);
}

if (!check) {
  console.log(`\ngen-schemas: wrote ${written.length} schema(s) to schemas/v1/\n`);
  process.exit(0);
}

// ---- verify against the committed tree ---------------------------------------------
const status = spawnSync("git", ["status", "--porcelain", "--", "schemas/"], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (status.status !== 0) {
  console.error("gen-schemas: could not run git status");
  process.exit(1);
}
if (status.stdout.trim() !== "") {
  console.error("\nschemas:check: FAILED — the generated contract differs from what is committed:\n");
  process.stderr.write(status.stdout);
  const diff = spawnSync("git", ["--no-pager", "diff", "--", "schemas/"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (diff.stdout.trim()) process.stderr.write("\n" + diff.stdout);
  console.error(
    "\nThe Zod schema changed without the contract being regenerated, or the regenerated" +
      "\ncontract is not committed yet. Review the change against the versioning policy in" +
      "\ndocs/SCHEMA.md, then commit schemas/ (staging alone is not enough).\n",
  );
  process.exit(1);
}
console.log("\n  contract matches the Zod source of truth");

/*
 * ---- conformance: does the contract accept what we actually produce? -----------------
 *
 * The drift check above only proves the JSON Schema agrees with Zod. It does not prove
 * either one agrees with the artifacts on disk. A published contract that rejects the
 * reference implementation's own output is the failure this project is named for, so every
 * committed artifact is validated against the schema a third-party producer would use.
 *
 * This is the same idea as `verify:goldens`: check the instrument against independent
 * evidence, not against its own recollection.
 */
const { default: Ajv } = await import(pathToFileURL(join(repoRoot, "node_modules/ajv/dist/ajv.js")).href);
const { parse: parseYaml } = await import(
  pathToFileURL(join(repoRoot, "packages/core/node_modules/yaml/dist/index.js")).href
);

const ajv = new Ajv({ allErrors: true, strict: false });
const load = (f) => JSON.parse(readFileSync(join(outDir, f), "utf8"));
const validators = {
  suite: ajv.compile(load("eval-suite.schema.json")),
  run: ajv.compile(load("run.schema.json")),
  scored: ajv.compile(load("scored-run.schema.json")),
};

/** Every artifact git tracks (or that is untracked-but-not-ignored), by kind. */
const listed = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  cwd: repoRoot,
  encoding: "utf8",
}).stdout.split("\n").filter(Boolean);

const subjects = [];
for (const f of listed) {
  if (/^packages\/seed-suite\/suites\/.+\.ya?ml$/.test(f)) subjects.push({ file: f, kind: "suite" });
  else if (/^goldens\/[^/]+\/suite\.ya?ml$/.test(f)) subjects.push({ file: f, kind: "suite" });
  else if (/^runs\/.+\.json$/.test(f) || /^goldens\/[^/]+\/run\.json$/.test(f))
    subjects.push({ file: f, kind: "run?" });
}

let conformanceFailures = 0;
for (const s of subjects) {
  const abs = join(repoRoot, s.file);
  if (!existsSync(abs)) continue;
  const raw = readFileSync(abs, "utf8");
  let data;
  try {
    data = s.kind === "suite" ? parseYaml(raw) : JSON.parse(raw);
  } catch (err) {
    console.error(`  UNPARSEABLE ${s.file}: ${String(err).slice(0, 120)}`);
    conformanceFailures++;
    continue;
  }

  // A run whose step_results carry `score` is a ScoredRun; otherwise a Run. The field is
  // `step_results`, not `steps` — getting that wrong silently validates every ScoredRun
  // against the Run schema, where the extra `score` trips additionalProperties.
  let kind = s.kind;
  if (kind === "run?") {
    const hasScores = (data.task_results ?? []).some((t) =>
      (t.step_results ?? []).some((st) => st && Object.prototype.hasOwnProperty.call(st, "score")),
    );
    kind = hasScores ? "scored" : "run";
  }

  const validate = validators[kind];
  if (!validate(data)) {
    conformanceFailures++;
    console.error(`\n  REJECTED  ${s.file}  (validated as ${kind})`);
    for (const e of (validate.errors ?? []).slice(0, 6)) {
      console.error(`      ${e.instancePath || "/"} ${e.message}`);
    }
  }
}

if (conformanceFailures > 0) {
  console.error(
    `\nschemas:check: FAILED — ${conformanceFailures} committed artifact(s) do not validate` +
      `\nagainst the published contract. Either the contract is wrong or the artifact is stale;` +
      `\npublishing a schema that rejects our own output is worse than publishing none.\n`,
  );
  process.exit(1);
}

console.log(`  ${subjects.length} committed artifact(s) validate against the published contract`);
console.log("\nschemas:check: OK\n");
