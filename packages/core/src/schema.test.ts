import { describe, expect, it } from "vitest";
import {
  EvalSuite,
  EvalTask,
  StepScore,
  parseRun,
  parseScoredRun,
  parseSuite,
} from "./schema.js";

const validStep = {
  n: 1,
  prompt: "do thing",
  expected_tools: ["read_pdf"],
  golden_truth: "thing is done",
};

const validTask = {
  id: "t1",
  initial_purpose: "p",
  overall_goal: "g",
  steps: [validStep],
};

const validSuite = {
  suite: {
    id: "s1",
    version: "0.1.0",
    description: "d",
    target_agent_type: "research-agent",
    dimensions_in_scope: ["calibration"],
    tasks: [validTask],
  },
};

describe("EvalStep", () => {
  it("accepts a minimal valid step", () => {
    expect(() =>
      EvalTask.parse({ ...validTask, steps: [validStep] }),
    ).not.toThrow();
  });

  it("applies scoring_hints defaults", () => {
    const parsed = EvalTask.parse({ ...validTask, steps: [validStep] });
    const s = parsed.steps[0]!;
    expect(s.scoring_hints.tool_match).toBe("subset");
    expect(s.scoring_hints.golden_truth_rubric).toBe("0-3");
    expect(s.scoring_hints.dimensions).toEqual([]);
  });

  it("rejects step with n=0", () => {
    expect(() =>
      EvalTask.parse({ ...validTask, steps: [{ ...validStep, n: 0 }] }),
    ).toThrow();
  });
});

describe("EvalTask", () => {
  it("requires at least one step", () => {
    expect(() => EvalTask.parse({ ...validTask, steps: [] })).toThrow();
  });

  it("rejects more than 9 steps", () => {
    const tooMany = Array.from({ length: 10 }, (_, i) => ({
      ...validStep,
      n: i + 1,
    }));
    expect(() => EvalTask.parse({ ...validTask, steps: tooMany })).toThrow();
  });

  it("defaults is_distraction to false", () => {
    const parsed = EvalTask.parse(validTask);
    expect(parsed.is_distraction).toBe(false);
  });
});

describe("EvalSuite", () => {
  it("parses a valid suite", () => {
    expect(() => parseSuite(validSuite)).not.toThrow();
  });

  it("rejects a suite with no tasks", () => {
    expect(() =>
      parseSuite({ suite: { ...validSuite.suite, tasks: [] } }),
    ).toThrow();
  });

  it("rejects unknown dimensions", () => {
    expect(() =>
      parseSuite({
        suite: { ...validSuite.suite, dimensions_in_scope: ["lol"] },
      }),
    ).toThrow();
  });

  it("accepts distraction tasks", () => {
    const parsed = EvalSuite.parse({
      suite: {
        ...validSuite.suite,
        tasks: [{ ...validTask, id: "t2", is_distraction: true }],
      },
    });
    expect(parsed.suite.tasks[0]!.is_distraction).toBe(true);
  });
});

describe("StepScore", () => {
  it("accepts a fully-reviewed score", () => {
    const score = {
      step_n: 1,
      tool_match: true,
      golden_truth: 3,
      distraction_caught: null,
      dimensions: { calibration: 2 },
      reviewer_notes: "ok",
      reviewer_id: "me",
      reviewed_at: new Date().toISOString(),
    };
    expect(() => StepScore.parse(score)).not.toThrow();
  });

  it("rejects golden_truth=4", () => {
    const score = {
      step_n: 1,
      tool_match: true,
      golden_truth: 4,
      distraction_caught: null,
      dimensions: {},
      reviewer_notes: "",
      reviewer_id: "me",
      reviewed_at: new Date().toISOString(),
    };
    expect(() => StepScore.parse(score)).toThrow();
  });
});

describe("Run / ScoredRun", () => {
  const run = {
    suite_id: "s1",
    suite_version: "0.1.0",
    run_id: "r1",
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    adapter: { name: "mock", model: "m1", config: {} },
    task_results: [
      {
        task_id: "t1",
        step_results: [
          {
            step_n: 1,
            agent_tool_calls: [],
            agent_final_output: "out",
            latency_ms: 5,
            auto_score: { tool_match: true, distraction_caught: null },
          },
        ],
      },
    ],
  };

  it("parseRun accepts a minimal run", () => {
    expect(() => parseRun(run)).not.toThrow();
  });

  it("parseScoredRun accepts a run with null scores", () => {
    const scored = {
      ...run,
      task_results: run.task_results.map((t) => ({
        task_id: t.task_id,
        step_results: t.step_results.map((s) => ({ ...s, score: null })),
      })),
    };
    expect(() => parseScoredRun(scored)).not.toThrow();
  });
});
