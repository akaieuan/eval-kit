import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  parseRun,
  parseScoredRun,
  parseSuite,
  type EvalSuite,
  type Run,
  type ScoredRun,
  type StepScore,
} from "@eval-kit/core";

export const RUNS_DIR = resolve(process.cwd(), "..", "..", "runs");
export const SUITES_DIR = resolve(
  process.cwd(),
  "..",
  "..",
  "packages",
  "seed-suite",
  "suites",
);

export type RunEntry =
  | { status: "scored"; file: string; run: ScoredRun }
  | { status: "unscored"; file: string; run: Run };

export async function listRuns(): Promise<RunEntry[]> {
  let entries: string[];
  try {
    entries = await readdir(RUNS_DIR);
  } catch {
    return [];
  }
  const out: RunEntry[] = [];
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const file = join(RUNS_DIR, name);
    try {
      const raw = JSON.parse(await readFile(file, "utf8"));
      if (name.endsWith(".scored.json")) {
        out.push({ status: "scored", file: name, run: parseScoredRun(raw) });
      } else {
        out.push({ status: "unscored", file: name, run: parseRun(raw) });
      }
    } catch {
      // skip malformed
    }
  }
  return out.sort((a, b) => b.run.started_at.localeCompare(a.run.started_at));
}

export async function loadRunById(runId: string): Promise<RunEntry | null> {
  const runs = await listRuns();
  return runs.find((r) => r.run.run_id === runId) ?? null;
}

export async function loadSuiteById(
  suiteId: string,
): Promise<EvalSuite | null> {
  const entries = await readdir(SUITES_DIR);
  for (const name of entries) {
    if (!name.endsWith(".yaml") && !name.endsWith(".yml")) continue;
    const { parse } = await import("yaml");
    try {
      const raw = parse(await readFile(join(SUITES_DIR, name), "utf8"));
      const suite = parseSuite(raw);
      if (suite.suite.id === suiteId) return suite;
    } catch {
      // skip
    }
  }
  return null;
}

export async function loadScoredRuns(): Promise<ScoredRun[]> {
  return (await listRuns())
    .filter(
      (r): r is Extract<RunEntry, { status: "scored" }> =>
        r.status === "scored",
    )
    .map((r) => r.run);
}

export async function loadUnscoredRuns(): Promise<Run[]> {
  return (await listRuns())
    .filter(
      (r): r is Extract<RunEntry, { status: "unscored" }> =>
        r.status === "unscored",
    )
    .map((r) => r.run);
}

export async function writeScoredRun(scored: ScoredRun): Promise<string> {
  const runs = await listRuns();
  const existing = runs.find((r) => r.run.run_id === scored.run_id);
  const baseName = existing
    ? existing.file.replace(/\.json$/, "").replace(/\.scored$/, "")
    : `${scored.started_at.slice(0, 10)}-${scored.adapter.name}-${scored.adapter.model}`;
  const outPath = join(RUNS_DIR, `${baseName}.scored.json`);
  await writeFile(outPath, JSON.stringify(scored, null, 2));
  return outPath;
}

export async function unreviewedStepCount(): Promise<number> {
  const runs = await listRuns();
  let total = 0;
  for (const entry of runs) {
    if (entry.status === "unscored") {
      for (const t of entry.run.task_results) {
        total += t.step_results.length;
      }
    } else {
      for (const t of entry.run.task_results) {
        for (const s of t.step_results) {
          const scoredStep = s as unknown as { score?: StepScore | null };
          if (!scoredStep.score) total += 1;
        }
      }
    }
  }
  return total;
}
