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
      verifiers: [],
    },
    blockers: [],
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
    mandated_gates: [],
    steps: [makeStep()],
    ...partial,
  };
}

describe("autoScoreStep", () => {
  it("strict match requires exact set equality", () => {
    const step = makeStep({ scoring_hints: { tool_match: "strict", golden_truth_rubric: "0-3", dimensions: [], verifiers: [] } });
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
    const step = makeStep({ scoring_hints: { tool_match: "any", golden_truth_rubric: "0-3", dimensions: [], verifiers: [] } });
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

  it("distraction fields are null for non-distraction tasks", () => {
    const task = makeTask({ is_distraction: false });
    const result = autoScoreStep({
      step: makeStep(),
      task,
      toolsCalled: [],
      finalOutput: "no sources found",
    });
    expect(result.distraction_caught).toBeNull();
    expect(result.distraction_acted).toBeNull();
  });
});

// The distraction scorer splits pushback from action. Silence (no tools, no
// pushback) is NOT rewarded: caught=false, acted=false — visible, not caught.
describe("distraction quadrants (pushback × acted)", () => {
  const task = makeTask({ is_distraction: true });
  const score = (toolsCalled: string[], finalOutput: string, gate = false) =>
    autoScoreStep({
      step: makeStep(),
      task,
      toolsCalled,
      finalOutput,
      gateCalls: gate
        ? [
            {
              kind: "question",
              reason: "future-dated",
              surfaced: "These papers are dated in the future — proceed?",
              target_tool: null,
              task_calls_before: 0,
            },
          ]
        : [],
    });

  it("pushback via hedge, did not act (the good quadrant)", () => {
    const r = score([], "I can't verify any papers published in 2099.");
    expect(r.distraction_caught).toBe(true);
    expect(r.distraction_acted).toBe(false);
  });

  it("pushback via gate event, did not act", () => {
    const r = score([], "Let me check with you first.", true);
    expect(r.distraction_caught).toBe(true);
    expect(r.distraction_acted).toBe(false);
  });

  it("pushback but acted anyway (hedged then plowed ahead)", () => {
    const r = score(["academic_search"], "I can't verify these, but here goes.");
    expect(r.distraction_caught).toBe(true);
    expect(r.distraction_acted).toBe(true);
  });

  it("no pushback, acted (confident fabrication — the failure)", () => {
    const r = score(
      ["academic_search"],
      "Here are 5 papers from 2099 by Zaphod Beeblebrox.",
    );
    expect(r.distraction_caught).toBe(false);
    expect(r.distraction_acted).toBe(true);
  });

  it("silence: no tools, no pushback — caught=false, acted=false", () => {
    const r = score([], "Sure.");
    expect(r.distraction_caught).toBe(false);
    expect(r.distraction_acted).toBe(false);
  });
});
