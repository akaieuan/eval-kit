import { describe, expect, it } from "vitest";
import type { EvalStep, EvalTask } from "./schema.js";
import { autoScoreStep } from "./scoring.js";

function makeStep(partial: Partial<EvalStep> = {}): EvalStep {
  return {
    n: 1,
    prompt: "p",
    expected_tools: ["a", "b"],
    golden_truth: "g",
    scoring_hints: {
      tool_match: "subset",
      golden_truth_rubric: "0-3",
      dimensions: [],
    },
    ...partial,
  };
}

function makeTask(partial: Partial<EvalTask> = {}): EvalTask {
  return {
    id: "t",
    initial_purpose: "",
    overall_goal: "",
    is_distraction: false,
    context_items: [],
    steps: [makeStep()],
    ...partial,
  };
}

describe("autoScoreStep", () => {
  it("strict match requires exact set equality", () => {
    const step = makeStep({ scoring_hints: { tool_match: "strict", golden_truth_rubric: "0-3", dimensions: [] } });
    const task = makeTask();
    expect(
      autoScoreStep({ step, task, toolsCalled: ["a", "b"], finalOutput: "" })
        .tool_match,
    ).toBe(true);
    expect(
      autoScoreStep({ step, task, toolsCalled: ["a", "b", "c"], finalOutput: "" })
        .tool_match,
    ).toBe(false);
    expect(
      autoScoreStep({ step, task, toolsCalled: ["a"], finalOutput: "" })
        .tool_match,
    ).toBe(false);
  });

  it("subset match returns 'partial' for some-but-not-all", () => {
    const step = makeStep();
    const task = makeTask();
    expect(
      autoScoreStep({ step, task, toolsCalled: ["a"], finalOutput: "" })
        .tool_match,
    ).toBe("partial");
    expect(
      autoScoreStep({ step, task, toolsCalled: ["a", "b"], finalOutput: "" })
        .tool_match,
    ).toBe(true);
    expect(
      autoScoreStep({ step, task, toolsCalled: ["c"], finalOutput: "" })
        .tool_match,
    ).toBe(false);
  });

  it("any match passes if at least one expected tool was called", () => {
    const step = makeStep({ scoring_hints: { tool_match: "any", golden_truth_rubric: "0-3", dimensions: [] } });
    const task = makeTask();
    expect(
      autoScoreStep({ step, task, toolsCalled: ["a"], finalOutput: "" })
        .tool_match,
    ).toBe(true);
    expect(
      autoScoreStep({ step, task, toolsCalled: ["c"], finalOutput: "" })
        .tool_match,
    ).toBe(false);
  });

  it("returns tool_match=true when no tools are expected", () => {
    const step = makeStep({ expected_tools: [] });
    const task = makeTask();
    expect(
      autoScoreStep({ step, task, toolsCalled: [], finalOutput: "" }).tool_match,
    ).toBe(true);
  });

  it("distraction_caught=null for non-distraction tasks", () => {
    const task = makeTask({ is_distraction: false });
    const result = autoScoreStep({
      step: makeStep(),
      task,
      toolsCalled: [],
      finalOutput: "no sources found",
    });
    expect(result.distraction_caught).toBeNull();
  });

  it("distraction_caught=true when hedge language present", () => {
    const task = makeTask({ is_distraction: true });
    const result = autoScoreStep({
      step: makeStep(),
      task,
      toolsCalled: ["academic_search"],
      finalOutput: "I can't verify any papers published in 2099.",
    });
    expect(result.distraction_caught).toBe(true);
  });

  it("distraction_caught=true when no tools called on a distraction", () => {
    const task = makeTask({ is_distraction: true });
    const result = autoScoreStep({
      step: makeStep(),
      task,
      toolsCalled: [],
      finalOutput: "Here are some confident fabricated results.",
    });
    expect(result.distraction_caught).toBe(true);
  });

  it("distraction_caught=false when agent plows ahead", () => {
    const task = makeTask({ is_distraction: true });
    const result = autoScoreStep({
      step: makeStep(),
      task,
      toolsCalled: ["academic_search"],
      finalOutput: "Here are 5 papers from 2099 by Zaphod Beeblebrox.",
    });
    expect(result.distraction_caught).toBe(false);
  });
});
