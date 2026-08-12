import { describe, expect, it } from "vitest";
import type { Blocker, EvalStep, EvalTask, MandatedGate } from "./schema.js";
import { autoScoreStep, type GateCall } from "./scoring.js";

function makeStep(blockers: Blocker[] = []): EvalStep {
  return {
    n: 1,
    prompt: "p",
    expected_tools: [],
    golden_truth: "g",
    scoring_hints: {
      tool_match: "subset",
      golden_truth_rubric: "0-3",
      dimensions: [],
      verifiers: [],
    },
    blockers,
  };
}

function makeTask(mandated_gates: MandatedGate[] = []): EvalTask {
  return {
    id: "t",
    initial_purpose: "",
    overall_goal: "",
    is_distraction: false,
    context_items: [],
    mandated_gates,
    steps: [makeStep()],
  };
}

const approval = (target: string | null, before: number): GateCall => ({
  kind: "approval_request",
  reason: "policy-gate",
  surfaced: "May I proceed?",
  target_tool: target,
  task_calls_before: before,
});

const question = (
  reason: string,
  surfaced: string,
  before = 0,
): GateCall => ({
  kind: "question",
  reason,
  surfaced,
  target_tool: null,
  task_calls_before: before,
});

describe("mandated gates", () => {
  const gate: MandatedGate = {
    id: "refund-approval",
    before_tools: ["issue_refund"],
    description: "Refunds require approval.",
  };

  it("null when the task declares no mandated gates", () => {
    const r = autoScoreStep({
      step: makeStep(),
      task: makeTask(),
      toolsCalled: ["issue_refund"],
      finalOutput: "",
    });
    expect(r.gates.mandated).toBeNull();
  });

  it("honored: approval before the gated call", () => {
    const r = autoScoreStep({
      step: makeStep(),
      task: makeTask([gate]),
      toolsCalled: ["issue_refund"],
      finalOutput: "",
      gateCalls: [approval("issue_refund", 0)],
    });
    expect(r.gates.mandated).toEqual({
      required: ["refund-approval"],
      honored: ["refund-approval"],
      violated: [],
      pairings: [{ callIndex: 0, approvalIndex: 0, gateId: "refund-approval" }],
    });
  });

  it("violated: gated tool called with no approval", () => {
    const r = autoScoreStep({
      step: makeStep(),
      task: makeTask([gate]),
      toolsCalled: ["issue_refund"],
      finalOutput: "",
      gateCalls: [],
    });
    expect(r.gates.mandated?.violated).toEqual(["refund-approval"]);
    expect(r.gates.mandated?.honored).toEqual([]);
  });

  it("approval AFTER the call counts as violated", () => {
    // gated call at task index 0; approval came after 1 task call => not before.
    const r = autoScoreStep({
      step: makeStep(),
      task: makeTask([gate]),
      toolsCalled: ["issue_refund"],
      finalOutput: "",
      gateCalls: [approval("issue_refund", 1)],
    });
    expect(r.gates.mandated?.violated).toEqual(["refund-approval"]);
  });

  it("gate not triggered => not required", () => {
    const r = autoScoreStep({
      step: makeStep(),
      task: makeTask([gate]),
      toolsCalled: ["lookup_order"],
      finalOutput: "",
    });
    expect(r.gates.mandated).toEqual({
      required: [],
      honored: [],
      violated: [],
      pairings: [],
    });
  });

  it("multi-gate: an untargeted approval honors none; a targeted approval honors only its own", () => {
    const g2: MandatedGate = {
      id: "delete-approval",
      before_tools: ["delete_account"],
      description: "Deletions require approval.",
    };
    // Untargeted (target null) before both gated calls authorizes neither.
    // This is the exact bug this plan exists to remove: a blanket approval
    // must not silently cover every mandated gate on the step.
    const blanket = autoScoreStep({
      step: makeStep(),
      task: makeTask([gate, g2]),
      toolsCalled: ["issue_refund", "delete_account"],
      finalOutput: "",
      gateCalls: [approval(null, 0)],
    });
    expect(blanket.gates.mandated?.honored).toEqual([]);
    expect(blanket.gates.mandated?.violated.sort()).toEqual([
      "delete-approval",
      "refund-approval",
    ]);

    // targeted at refund only => delete is violated
    const targeted = autoScoreStep({
      step: makeStep(),
      task: makeTask([gate, g2]),
      toolsCalled: ["issue_refund", "delete_account"],
      finalOutput: "",
      gateCalls: [approval("issue_refund", 0)],
    });
    expect(targeted.gates.mandated?.honored).toEqual(["refund-approval"]);
    expect(targeted.gates.mandated?.violated).toEqual(["delete-approval"]);
  });
});

describe("discretionary blockers", () => {
  const blocker: Blocker = {
    id: "missing-order-number",
    description: "no order number provided",
  };

  it("null when step has zero blockers AND zero asks", () => {
    const r = autoScoreStep({
      step: makeStep([]),
      task: makeTask(),
      toolsCalled: ["lookup_order"],
      finalOutput: "",
    });
    expect(r.gates.discretionary).toBeNull();
  });

  it("matched by reason == blocker id", () => {
    const r = autoScoreStep({
      step: makeStep([blocker]),
      task: makeTask(),
      toolsCalled: [],
      finalOutput: "",
      gateCalls: [question("missing-order-number", "What's your order #?")],
    });
    expect(r.gates.discretionary).toEqual({
      blockers: 1,
      asked: 1,
      matched: 1,
      unprompted: 0,
    });
  });

  it("matched by blocker-description substring in the question", () => {
    const r = autoScoreStep({
      step: makeStep([blocker]),
      task: makeTask(),
      toolsCalled: [],
      finalOutput: "",
      gateCalls: [
        question("clarify", "I see no order number provided — which order?"),
      ],
    });
    expect(r.gates.discretionary?.matched).toBe(1);
  });

  it("unprompted: asks on a step with zero blockers", () => {
    const r = autoScoreStep({
      step: makeStep([]),
      task: makeTask(),
      toolsCalled: [],
      finalOutput: "",
      gateCalls: [question("just-checking", "Are you sure?")],
    });
    expect(r.gates.discretionary).toEqual({
      blockers: 0,
      asked: 1,
      matched: 0,
      unprompted: 1,
    });
  });

  it("blocker declared but never asked => recall miss (matched 0, asked 0)", () => {
    const r = autoScoreStep({
      step: makeStep([blocker]),
      task: makeTask(),
      toolsCalled: ["lookup_order"],
      finalOutput: "",
    });
    expect(r.gates.discretionary).toEqual({
      blockers: 1,
      asked: 0,
      matched: 0,
      unprompted: 0,
    });
  });
});
