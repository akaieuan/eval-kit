#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import ansis from "ansis";
import { createAnthropicAdapter } from "./adapters/anthropic.js";
import { createMockAdapter } from "./adapters/mock.js";
import type { AgentAdapter } from "./adapters/types.js";
import {
  adapterFromProfile,
  loadAgentProfile,
} from "./agents/index.js";
import { evaluateCi } from "./ci.js";
import { diffRuns } from "./diff.js";
import {
  exportDpo,
  exportRaw,
  exportSft,
  toJsonl,
  type ExportFormat,
} from "./export.js";
import { runInit } from "./init/index.js";
import { loadRun, loadScoredRun, loadSuite } from "./loader.js";
import { runSuite } from "./runner.js";
import { aggregateScoredRun } from "./scoring.js";

const program = new Command();
program
  .name("eval-kit")
  .description(
    "Open-source evaluation framework for research agents. Humans score, not LLMs.",
  )
  .version("0.2.0");

function isPathLike(name: string): boolean {
  return (
    name.startsWith("./") ||
    name.startsWith("../") ||
    name.startsWith("/") ||
    name.endsWith(".js") ||
    name.endsWith(".mjs") ||
    name.endsWith(".cjs")
  );
}

async function loadAdapterFromPath(p: string): Promise<AgentAdapter> {
  const abs = resolve(p);
  const mod = (await import(abs)) as {
    default?: unknown;
    adapter?: unknown;
  };
  const candidate = (mod.default ?? mod.adapter) as
    | AgentAdapter
    | ((opts?: unknown) => AgentAdapter)
    | undefined;
  if (!candidate) {
    throw new Error(
      `Custom adapter "${p}" must default-export an AgentAdapter or a () => AgentAdapter factory.`,
    );
  }
  const adapter =
    typeof candidate === "function"
      ? (candidate as () => AgentAdapter)()
      : candidate;
  if (!adapter || typeof adapter.run !== "function") {
    throw new Error(
      `Custom adapter "${p}" did not produce a valid AgentAdapter (missing .run()).`,
    );
  }
  return adapter;
}

async function buildAdapter(
  nameOrPath: string,
  opts: { model?: string; degraded?: boolean },
): Promise<AgentAdapter> {
  if (isPathLike(nameOrPath)) {
    return loadAdapterFromPath(nameOrPath);
  }
  switch (nameOrPath) {
    case "mock":
      return createMockAdapter({
        degraded: opts.degraded,
        model: opts.model,
      });
    case "anthropic":
      return createAnthropicAdapter({ model: opts.model });
    default:
      throw new Error(
        `Unknown adapter "${nameOrPath}". Built-in: mock | anthropic. For a file path pass --adapter ./path.js. For a YAML profile pass --agent ./agents/my.yaml.`,
      );
  }
}

program
  .command("run")
  .argument("<suite>", "path to suite YAML/JSON")
  .option(
    "-a, --adapter <name>",
    "built-in (mock|anthropic) or path to a custom adapter file",
    "mock",
  )
  .option(
    "--agent <profile>",
    "path to an agent profile YAML (overrides --adapter)",
  )
  .option("--model <model>", "adapter model identifier (ignored with --agent)")
  .option("--degraded", "use degraded mock (simulates regressions)", false)
  .option("-o, --out <path>", "output run artifact path")
  .action(async (suitePath, opts) => {
    const suite = await loadSuite(resolve(suitePath));
    const adapter = opts.agent
      ? adapterFromProfile(await loadAgentProfile(resolve(opts.agent)))
      : await buildAdapter(opts.adapter, {
          model: opts.model,
          degraded: opts.degraded,
        });
    console.log(
      ansis.dim(
        `→ running ${suite.suite.tasks.length} tasks against ${adapter.name}/${adapter.model}`,
      ),
    );
    const run = await runSuite(suite, {
      adapter,
      onStepStart: (task, n) =>
        console.log(ansis.dim(`  ${task.id} step ${n}`)),
    });
    const outPath = resolve(
      opts.out ??
        `runs/${run.started_at.slice(0, 10)}-${adapter.name}-${adapter.model}.json`,
    );
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(run, null, 2));
    console.log(ansis.green(`\n✓ wrote ${outPath}`));
  });

program
  .command("review")
  .argument("<run>", "path to run.json")
  .action(async (runPath) => {
    const run = await loadRun(resolve(runPath));
    console.log(
      `Run ${ansis.cyan(run.run_id.slice(0, 8))} over ${run.task_results.length} tasks.`,
    );
    console.log(
      ansis.dim(
        `Open this file in the eval-kit dashboard to score steps:\n  pnpm --filter @eval-kit/dashboard dev\n  http://localhost:3000/runs/${run.run_id}`,
      ),
    );
  });

program
  .command("diff")
  .argument("<a>", "first scored run (.scored.json)")
  .argument("<b>", "second scored run (.scored.json)")
  .action(async (aPath, bPath) => {
    const [a, b] = await Promise.all([
      loadScoredRun(resolve(aPath)),
      loadScoredRun(resolve(bPath)),
    ]);
    const diffs = diffRuns(a, b);
    const regressions = diffs.filter((d) => d.kind === "regression");
    const improvements = diffs.filter((d) => d.kind === "improvement");
    console.log(
      ansis.bold(
        `Compared ${diffs.length} steps — ${ansis.red(
          `${regressions.length} regressions`,
        )}, ${ansis.green(`${improvements.length} improvements`)}`,
      ),
    );
    for (const d of regressions) {
      if (d.kind !== "regression") continue;
      console.log(
        `${ansis.red("✗")} ${d.task_id} step ${d.step_n}: ${d.reasons.join(", ")}`,
      );
    }
    for (const d of improvements) {
      if (d.kind !== "improvement") continue;
      console.log(
        `${ansis.green("✓")} ${d.task_id} step ${d.step_n}: ${d.reasons.join(", ")}`,
      );
    }
  });

program
  .command("report")
  .argument("<run>", "path to scored run (.scored.json)")
  .action(async (runPath) => {
    const run = await loadScoredRun(resolve(runPath));
    const agg = aggregateScoredRun(run);
    console.log(JSON.stringify(agg, null, 2));
  });

program
  .command("init")
  .argument("[dir]", "target directory (default: current dir)", ".")
  .option("-n, --name <name>", "project name")
  .option("-f, --force", "overwrite non-empty target", false)
  .description("Scaffold a new eval-kit project (suites + adapters + runs)")
  .action(async (dir, opts) => {
    try {
      const result = await runInit({
        targetDir: dir,
        projectName: opts.name,
        force: opts.force,
      });
      console.log(ansis.green(`✓ scaffolded ${result.path}`));
      for (const f of result.created) console.log(ansis.dim(`  ${f}`));
      console.log(
        ansis.dim(
          `\nNext: cd ${result.path} && pnpm install && pnpm eval-kit run suites/starter.yaml`,
        ),
      );
    } catch (err) {
      console.error(
        ansis.red(`✗ init failed: ${err instanceof Error ? err.message : err}`),
      );
      process.exit(1);
    }
  });

program
  .command("preflight")
  .argument("<suite>", "path to suite YAML/JSON")
  .option(
    "-a, --adapter <name>",
    "built-in (mock|anthropic) or path to a custom adapter file",
    "mock",
  )
  .option("--agent <profile>", "path to an agent profile YAML")
  .option("--model <model>", "adapter model identifier")
  .description("Dry-run the first step of the first task for sanity check")
  .action(async (suitePath, opts) => {
    const suite = await loadSuite(resolve(suitePath));
    const firstTask = suite.suite.tasks[0];
    if (!firstTask) {
      console.error(ansis.red("✗ suite has no tasks"));
      process.exit(1);
    }
    const firstStep = firstTask.steps[0];
    if (!firstStep) {
      console.error(ansis.red("✗ first task has no steps"));
      process.exit(1);
    }
    const adapter = opts.agent
      ? adapterFromProfile(await loadAgentProfile(resolve(opts.agent)))
      : await buildAdapter(opts.adapter, { model: opts.model });
    console.log(
      ansis.dim(
        `Preflight: ${firstTask.id} step ${firstStep.n} via ${adapter.name}/${adapter.model}`,
      ),
    );
    try {
      const out = await adapter.run({
        prompt: firstStep.prompt,
        context: firstTask.context_items,
        expected_tools: firstStep.expected_tools,
        prior_steps: [],
      });
      console.log(ansis.green(`✓ adapter returned in ${out.latency_ms}ms`));
      console.log(
        ansis.dim(
          `  ${out.tool_calls.length} tool call${out.tool_calls.length === 1 ? "" : "s"}: ${out.tool_calls.map((t) => t.tool).join(", ") || "(none)"}`,
        ),
      );
      console.log(
        ansis.dim(`  output: ${out.final_output.slice(0, 160)}…`),
      );
    } catch (err) {
      console.error(
        ansis.red(
          `✗ adapter threw: ${err instanceof Error ? err.message : err}`,
        ),
      );
      process.exit(1);
    }
  });

program
  .command("ci")
  .argument("<suite>", "path to suite YAML/JSON")
  .option(
    "-a, --adapter <name>",
    "built-in (mock|anthropic) or path to a custom adapter file",
    "mock",
  )
  .option("--agent <profile>", "path to an agent profile YAML")
  .option("--model <model>", "adapter model identifier")
  .option(
    "--baseline <path>",
    "path to a scored run to compare against for tier-1 regressions",
  )
  .option(
    "--min-tool-match <pct>",
    "fail if aggregate tool-match accuracy < pct (0-100)",
    parseFloat,
  )
  .option(
    "--min-distraction-catch <pct>",
    "fail if distraction detection rate < pct (0-100)",
    parseFloat,
  )
  .option(
    "--max-prefilled <pct>",
    "fail if pre_filled ratio > pct (0-100) — guards against LLM-judge creep",
    parseFloat,
  )
  .option("-o, --out <path>", "output run artifact path")
  .description(
    "Run a suite + gate on tier-1 (auto-scored) regressions. Exits non-zero on failure.",
  )
  .action(async (suitePath, opts) => {
    const suite = await loadSuite(resolve(suitePath));
    const adapter = opts.agent
      ? adapterFromProfile(await loadAgentProfile(resolve(opts.agent)))
      : await buildAdapter(opts.adapter, {
          model: opts.model,
        });
    console.log(
      ansis.dim(
        `→ ci run: ${suite.suite.tasks.length} tasks · ${adapter.name}/${adapter.model}`,
      ),
    );
    const run = await runSuite(suite, { adapter });
    const outPath = resolve(
      opts.out ??
        `runs/${run.started_at.slice(0, 10)}-${adapter.name}-${adapter.model}.json`,
    );
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(run, null, 2));

    const baseline = opts.baseline
      ? await loadScoredRun(resolve(opts.baseline))
      : undefined;

    const outcome = evaluateCi({
      run,
      baseline,
      thresholds: {
        minToolMatch:
          typeof opts.minToolMatch === "number"
            ? opts.minToolMatch / 100
            : undefined,
        minDistractionCatch:
          typeof opts.minDistractionCatch === "number"
            ? opts.minDistractionCatch / 100
            : undefined,
        maxPrefilledRatio:
          typeof opts.maxPrefilled === "number"
            ? opts.maxPrefilled / 100
            : undefined,
      },
    });

    if (outcome.aggregate) {
      const a = outcome.aggregate;
      console.log(
        `  tool_match=${(a.tool_match_accuracy * 100).toFixed(1)}%  ` +
          `distraction=${a.distraction_detection_rate === null ? "n/a" : (a.distraction_detection_rate * 100).toFixed(1) + "%"}  ` +
          `steps=${a.total_steps} reviewed=${a.reviewed_steps}`,
      );
    }

    if (outcome.violations.length > 0) {
      console.log(ansis.red(`\n✗ CI failed:`));
      for (const v of outcome.violations) console.log(ansis.red(`  · ${v}`));
    } else {
      console.log(ansis.green(`\n✓ CI passed`));
    }
    console.log(ansis.dim(`\nrun artifact: ${outPath}`));
    process.exit(outcome.exitCode);
  });

program
  .command("export")
  .argument("<run>", "path to scored run (.scored.json)")
  .option("-f, --format <fmt>", "sft | dpo | raw", "sft")
  .option(
    "--compared-with <path>",
    "second scored run (required for --format dpo)",
  )
  .option("-s, --suite <path>", "optional suite YAML for real step prompts")
  .option(
    "--min-score <n>",
    "include only steps with golden_truth >= n (sft only)",
    (v) => parseInt(v, 10),
  )
  .option(
    "--include-prefilled",
    "include pre_filled scores in output (default: false)",
    false,
  )
  .option("-o, --out <path>", "output JSONL path")
  .description(
    "Convert scored runs to JSONL training data (SFT / DPO / raw shapes).",
  )
  .action(async (runPath, opts) => {
    const format: ExportFormat = opts.format;
    const suite = opts.suite ? await loadSuite(resolve(opts.suite)) : undefined;
    const run = await loadScoredRun(resolve(runPath));

    let records: Array<Record<string, unknown>> = [];
    if (format === "sft") {
      records = exportSft(run, {
        minGoldenTruth: opts.minScore,
        includePreFilled: opts.includePrefilled,
        suite,
      }) as unknown as Array<Record<string, unknown>>;
    } else if (format === "dpo") {
      if (!opts.comparedWith) {
        console.error(
          ansis.red(
            "--format dpo requires --compared-with <path-to-second-scored-run>",
          ),
        );
        process.exit(2);
      }
      const b = await loadScoredRun(resolve(opts.comparedWith));
      records = exportDpo(run, b, { suite }) as unknown as Array<
        Record<string, unknown>
      >;
    } else if (format === "raw") {
      records = exportRaw(run, { suite });
    } else {
      console.error(ansis.red(`Unknown format "${format}". Use sft|dpo|raw.`));
      process.exit(2);
    }

    const jsonl = toJsonl(records);
    if (opts.out) {
      const outPath = resolve(opts.out);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, jsonl);
      console.log(
        ansis.green(
          `✓ wrote ${records.length} ${format} record${records.length === 1 ? "" : "s"} → ${outPath}`,
        ),
      );
    } else {
      process.stdout.write(jsonl);
    }
  });

program.parseAsync().catch((err) => {
  console.error(ansis.red(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
