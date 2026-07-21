import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as toYaml } from "yaml";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { E2E_SUITE_DOC } from "./__fixtures__/e2e-suite.js";
import { parseRun, parseScoredRun } from "./schema.js";
import { mergeScores } from "./scoring.js";

/**
 * The CLI itself, spawned as a user would run it: a real suite YAML on disk, the
 * mock adapter, and artifacts written to a temp working directory. No network,
 * no API key (both are stripped from the child env below to prove it), and
 * nothing written outside the temp dir — every path handed to the CLI is
 * relative, and the child's cwd is the temp dir.
 *
 * Requires a build: this runs `dist/cli.js`, which is what actually ships.
 * CI builds before it tests, and so does `prepublishOnly`.
 */

const cliPath = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

let cwd: string;

/** Run the CLI in the temp dir with a hermetic env. */
function cli(...args: string[]) {
  const { ANTHROPIC_API_KEY: _key, OPENAI_API_KEY: _oai, ...env } = process.env;
  const res = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...env, NO_COLOR: "1" },
  });
  return {
    status: res.status,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(join(cwd, rel), "utf8"));

beforeAll(() => {
  if (!existsSync(cliPath)) {
    throw new Error(
      `CLI end-to-end tests need the built CLI at ${cliPath}. Run \`pnpm build\` first.`,
    );
  }
  cwd = mkdtempSync(join(tmpdir(), "eval-kit-cli-"));
  writeFileSync(join(cwd, "suite.yaml"), toYaml(E2E_SUITE_DOC));
  // A custom adapter, loaded from a path — the documented escape hatch, and the
  // only way to drive `ci` with a failing agent (it has no --degraded flag).
  writeFileSync(
    join(cwd, "flatlined.mjs"),
    [
      "export default {",
      '  name: "flatlined",',
      '  model: "v0",',
      "  config: {},",
      "  async run() {",
      '    return { tool_calls: [], final_output: "no attempt", latency_ms: 1 };',
      "  },",
      "};",
      "",
    ].join("\n"),
  );
});

afterAll(() => {
  if (cwd) rmSync(cwd, { recursive: true, force: true });
});

describe("eval-kit run", () => {
  it("writes a schema-valid Run artifact and exits 0", () => {
    const res = cli("run", "suite.yaml", "--adapter", "mock", "-o", "runs/mock.json");

    expect(res.stderr).toBe("");
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("running 2 tasks against mock/mock-1");
    expect(res.stdout).toContain("wrote");

    const run = parseRun(readJson("runs/mock.json"));
    expect(run.suite_id).toBe("e2e-gate-suite");
    expect(run.adapter.name).toBe("mock");
    expect(
      run.task_results.map((t) => [t.task_id, t.step_results.length]),
    ).toEqual([
      ["t-research", 2],
      ["t-distraction", 1],
    ]);
    // The mock never gates, so the artifact carries no gate events — but it
    // does carry the gate-scoring fields, which is what makes it re-scorable.
    const first = run.task_results[0]!.step_results[0]!;
    expect(first.gate_events).toEqual([]);
    expect(first.auto_score.gates.mandated).not.toBeUndefined();
  });

  it("writes a visibly worse artifact with --degraded", () => {
    const res = cli(
      "run",
      "suite.yaml",
      "--adapter",
      "mock",
      "--degraded",
      "-o",
      "runs/degraded.json",
    );

    expect(res.status).toBe(0);
    const run = parseRun(readJson("runs/degraded.json"));
    for (const task of run.task_results) {
      for (const step of task.step_results) {
        expect(step.agent_tool_calls).toEqual([]);
      }
    }
  });

  it("reports a bad suite path without writing anything", () => {
    const res = cli("run", "missing.yaml", "-o", "runs/never.json");
    expect(res.status).not.toBe(0);
    expect(existsSync(join(cwd, "runs/never.json"))).toBe(false);
  });
});

describe("eval-kit ci --baseline", () => {
  /** Promote a run artifact on disk to a ScoredRun file (all scores null). */
  function baselineFrom(runRel: string, outRel: string) {
    const scored = mergeScores(parseRun(readJson(runRel)), new Map());
    writeFileSync(join(cwd, outRel), JSON.stringify(scored, null, 2));
    parseScoredRun(readJson(outRel)); // the CLI will parse it; fail here if malformed
  }

  beforeAll(() => {
    cli("run", "suite.yaml", "--adapter", "mock", "-o", "runs/base.json");
    baselineFrom("runs/base.json", "baseline.scored.json");
  });

  it("exits 0 when the run matches its baseline", () => {
    const res = cli(
      "ci",
      "suite.yaml",
      "--adapter",
      "mock",
      "--baseline",
      "baseline.scored.json",
      "-o",
      "runs/ci-equal.json",
    );

    expect(res.status).toBe(0);
    expect(res.stdout).toContain("CI passed");
  });

  it("exits non-zero when the run regresses against its baseline", () => {
    const res = cli(
      "ci",
      "suite.yaml",
      "--adapter",
      "./flatlined.mjs",
      "--baseline",
      "baseline.scored.json",
      "-o",
      "runs/ci-regressed.json",
    );

    expect(res.status).toBe(1);
    expect(res.stdout).toContain("CI failed");
    expect(res.stdout).toContain("tier-1 regression");
    // It still writes the artifact — a failing gate must leave evidence.
    expect(parseRun(readJson("runs/ci-regressed.json")).adapter.name).toBe(
      "flatlined",
    );
  });

  it("exits non-zero when a threshold is missed, with no baseline at all", () => {
    const res = cli(
      "ci",
      "suite.yaml",
      "--adapter",
      "./flatlined.mjs",
      "--min-tool-match",
      "90",
      "-o",
      "runs/ci-threshold.json",
    );

    expect(res.status).toBe(1);
    expect(res.stdout).toContain("tool_match_accuracy");
    expect(res.stdout).toContain("< threshold 90%");
  });

  it("exits 0 when a competent run clears the same threshold", () => {
    const res = cli(
      "ci",
      "suite.yaml",
      "--adapter",
      "mock",
      "--min-tool-match",
      "90",
      "-o",
      "runs/ci-pass.json",
    );

    expect(res.status).toBe(0);
    expect(res.stdout).toContain("CI passed");
  });
});
