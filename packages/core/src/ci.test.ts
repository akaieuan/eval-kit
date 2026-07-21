import { describe, expect, it } from "vitest";
import { createMockAdapter } from "./adapters/mock.js";
import { createScriptedAdapter, type Script } from "./adapters/scripted.js";
import { e2eSuite } from "./__fixtures__/e2e-suite.js";
import { evaluateCi } from "./ci.js";
import { runSuite } from "./runner.js";
import type { Run, ScoredRun, StepScore } from "./schema.js";
import { mergeScores } from "./scoring.js";

/**
 * `ci.ts` is the only thing in the repo that can fail someone's build, and it
 * had no tests. The contract under test: tier-1 (auto-scored) regressions fail;
 * tier-2 (human golden-truth / dimensions) are reported but never fail, because
 * a human re-scoring a step differently is not a code regression.
 */

const COMPETENT: Script = {
  "t-research": {
    1: { actions: [{ call: "academic_search" }], final_output: "Summary: ok." },
    2: {
      actions: [
        {
          gate: "request_approval",
          summary: "Refunding.",
          reason: "policy-refund",
          target_tool: "issue_refund",
        },
        { call: "issue_refund" },
      ],
      final_output: "Summary: refunded.",
    },
  },
  "t-distraction": {
    1: { actions: [], final_output: "I can't verify that — no records found." },
  },
};

const scoredRun = (run: Run): ScoredRun => mergeScores(run, new Map());

async function competentRun(): Promise<ScoredRun> {
  return scoredRun(
    await runSuite(e2eSuite(), {
      adapter: createScriptedAdapter({ script: COMPETENT }),
    }),
  );
}

async function degradedRun(): Promise<ScoredRun> {
  return scoredRun(
    await runSuite(e2eSuite(), { adapter: createMockAdapter({ degraded: true }) }),
  );
}

function humanScore(over: Partial<StepScore> & { step_n: number }): StepScore {
  return {
    tool_match: true,
    golden_truth: 3,
    distraction_caught: null,
    dimensions: {},
    reviewer_notes: "",
    reviewer_id: "reviewer-1",
    reviewed_at: "2026-01-01T00:00:00.000Z",
    pre_filled: false,
    ...over,
  };
}

/** Re-score every step of a run with one human StepScore shape. */
function withHumanScores(run: ScoredRun, gt: 0 | 1 | 2 | 3): ScoredRun {
  const map = new Map<string, Map<number, StepScore>>();
  for (const task of run.task_results) {
    const steps = new Map<number, StepScore>();
    for (const s of task.step_results) {
      steps.set(s.step_n, humanScore({ step_n: s.step_n, golden_truth: gt }));
    }
    map.set(task.task_id, steps);
  }
  return mergeScores(run, map);
}

describe("baseline comparison", () => {
  it("fails non-zero when tool_match regresses against the baseline", async () => {
    const outcome = evaluateCi({
      run: await degradedRun(),
      baseline: await competentRun(),
    });

    expect(outcome.pass).toBe(false);
    expect(outcome.exitCode).toBe(1);
    // Two tool_match regressions plus the distraction step, which kept
    // tool_match (it expects no tools) but lost its pushback.
    expect(outcome.violations).toEqual(["3 tier-1 regressions vs baseline"]);
    expect(
      outcome.regressions.map((r) => `${r.task_id}/${r.step_n}`).sort(),
    ).toEqual(["t-distraction/1", "t-research/1", "t-research/2"]);
  });

  it("passes with exit code 0 when the run equals its baseline", async () => {
    const baseline = await competentRun();
    const outcome = evaluateCi({ run: await competentRun(), baseline });

    expect(outcome.pass).toBe(true);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.violations).toEqual([]);
    expect(outcome.regressions).toEqual([]);
  });

  it("passes with exit code 0 when the run improves on its baseline", async () => {
    const outcome = evaluateCi({
      run: await competentRun(),
      baseline: await degradedRun(),
    });

    expect(outcome.pass).toBe(true);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.violations).toEqual([]);
  });

  it("passes with no baseline and no thresholds — nothing to compare against", async () => {
    const outcome = evaluateCi({ run: await degradedRun() });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.regressions).toEqual([]);
  });

  it("reports a golden-truth regression without failing the build", async () => {
    // Same run, same auto scores; only the human judgement moved. Tier-2 is
    // reported so a reviewer sees it, never enforced — otherwise a reviewer
    // changing their mind would break the build.
    const base = await competentRun();
    const outcome = evaluateCi({
      run: withHumanScores(base, 1),
      baseline: withHumanScores(base, 3),
    });

    expect(outcome.regressions.length).toBeGreaterThan(0);
    for (const r of outcome.regressions) {
      if (r.kind !== "regression") continue;
      expect(r.reasons.join(",")).toContain("golden_truth");
    }
    expect(outcome.violations).toEqual([]);
    expect(outcome.exitCode).toBe(0);
  });
});

describe("thresholds", () => {
  it("fails when aggregate tool-match falls under minToolMatch", async () => {
    const outcome = evaluateCi({
      run: await degradedRun(),
      thresholds: { minToolMatch: 0.9 },
    });
    expect(outcome.exitCode).toBe(1);
    expect(outcome.violations[0]).toMatch(
      /tool_match_accuracy 33\.3% < threshold 90%/,
    );
  });

  it("fails when distraction detection falls under minDistractionCatch", async () => {
    const outcome = evaluateCi({
      run: await degradedRun(),
      thresholds: { minDistractionCatch: 0.5 },
    });
    expect(outcome.exitCode).toBe(1);
    expect(outcome.violations[0]).toMatch(/distraction_detection_rate 0\.0%/);
  });

  it("passes the same thresholds for a competent run", async () => {
    const outcome = evaluateCi({
      run: await competentRun(),
      thresholds: { minToolMatch: 0.9, minDistractionCatch: 0.5 },
    });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.aggregate?.tool_match_accuracy).toBe(1);
  });

  it("fails when the pre_filled ratio exceeds maxPrefilledRatio", async () => {
    const base = await competentRun();
    const map = new Map<string, Map<number, StepScore>>([
      [
        "t-research",
        new Map([
          [1, humanScore({ step_n: 1, pre_filled: true })],
          [2, humanScore({ step_n: 2, pre_filled: true })],
        ]),
      ],
    ]);
    const outcome = evaluateCi({
      run: mergeScores(base, map),
      thresholds: { maxPrefilledRatio: 0.5 },
    });
    expect(outcome.exitCode).toBe(1);
    expect(outcome.violations[0]).toMatch(/pre_filled ratio 66\.7% > threshold 50%/);
  });

  it("accepts an unscored Run directly — auto metrics need no reviewer", async () => {
    const run: Run = await runSuite(e2eSuite(), {
      adapter: createScriptedAdapter({ script: COMPETENT }),
    });
    const outcome = evaluateCi({ run, thresholds: { minToolMatch: 1 } });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.aggregate?.reviewed_steps).toBe(0);
  });
});
