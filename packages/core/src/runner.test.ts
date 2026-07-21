import { describe, expect, it } from "vitest";
import { createMockAdapter } from "./adapters/mock.js";
import type {
  AgentAdapter,
  AgentRunInput,
  AgentRunOutput,
} from "./adapters/types.js";
import { resolveToolbox, runSuite } from "./runner.js";
import { parseSuite, type EvalSuite } from "./schema.js";
import type { ToolCall } from "./schema.js";

function suiteWith(overrides: {
  toolbox?: Array<{ name: string; description?: string }>;
  expected_tools?: string[];
  blockers?: Array<{ id: string; description: string }>;
  mandated_gates?: Array<{ id: string; before_tools: string[]; description: string }>;
  verifiers?: Array<{ id: string; params?: object }>;
  is_distraction?: boolean;
}): EvalSuite {
  return parseSuite({
    suite: {
      id: "s",
      version: "0.1.0",
      description: "d",
      target_agent_type: "research-agent",
      dimensions_in_scope: ["calibration"],
      ...(overrides.toolbox ? { toolbox: overrides.toolbox } : {}),
      tasks: [
        {
          id: "t1",
          initial_purpose: "p",
          overall_goal: "g",
          is_distraction: overrides.is_distraction ?? false,
          ...(overrides.mandated_gates
            ? { mandated_gates: overrides.mandated_gates }
            : {}),
          steps: [
            {
              n: 1,
              prompt: "do the thing",
              expected_tools: overrides.expected_tools ?? ["read_pdf"],
              golden_truth: "done",
              ...(overrides.blockers ? { blockers: overrides.blockers } : {}),
              ...(overrides.verifiers
                ? { scoring_hints: { verifiers: overrides.verifiers } }
                : {}),
            },
          ],
        },
      ],
    },
  });
}

/** An adapter that records the input it received and can script tool calls. */
function recordingAdapter(scriptedCalls: ToolCall[] = []): AgentAdapter & {
  lastInput?: AgentRunInput;
} {
  const self: AgentAdapter & { lastInput?: AgentRunInput } = {
    name: "recorder",
    model: "rec-1",
    config: {},
    async run(input: AgentRunInput): Promise<AgentRunOutput> {
      self.lastInput = input;
      return { tool_calls: scriptedCalls, final_output: "ok", latency_ms: 1 };
    },
  };
  return self;
}

describe("toolbox resolution", () => {
  it("uses the explicit suite-level toolbox when present", () => {
    const suite = suiteWith({
      toolbox: [{ name: "web_search" }, { name: "academic_search" }],
    });
    expect(resolveToolbox(suite).map((t) => t.name)).toEqual([
      "web_search",
      "academic_search",
    ]);
  });

  it("falls back to the union of expected_tools for legacy suites", () => {
    const suite = suiteWith({ expected_tools: ["read_pdf", "take_notes"] });
    expect(resolveToolbox(suite).map((t) => t.name)).toEqual([
      "read_pdf",
      "take_notes",
    ]);
  });
});

describe("adapter receives toolbox, not expected_tools", () => {
  it("passes toolbox (+ gate tools) and no expected_tools field", async () => {
    const adapter = recordingAdapter();
    const suite = suiteWith({ toolbox: [{ name: "web_search" }] });
    await runSuite(suite, { adapter });
    const input = adapter.lastInput!;
    expect(input.toolbox.map((t) => t.name)).toEqual([
      "web_search",
      "request_approval",
      "ask_user",
    ]);
    // expected_tools must NOT leak to the agent.
    expect((input as Record<string, unknown>).expected_tools).toBeUndefined();
  });

  it("gating.mode 'unavailable' withholds the gate tools", async () => {
    const adapter = recordingAdapter();
    const suite = suiteWith({ toolbox: [{ name: "web_search" }] });
    await runSuite(suite, { adapter, gating: { mode: "unavailable" } });
    expect(adapter.lastInput!.toolbox.map((t) => t.name)).toEqual([
      "web_search",
    ]);
  });

  it("the mock adapter calls task tools from the toolbox, never gate tools", async () => {
    const adapter = createMockAdapter();
    const suite = suiteWith({ toolbox: [{ name: "web_search" }] });
    const run = await runSuite(suite, { adapter });
    const calls = run.task_results[0]!.step_results[0]!.agent_tool_calls.map(
      (c) => c.tool,
    );
    expect(calls).toEqual(["web_search"]);
    expect(run.task_results[0]!.step_results[0]!.gate_events).toEqual([]);
  });
});

describe("gate extraction", () => {
  it("splits gate calls into gate_events and excludes them from agent_tool_calls", async () => {
    const adapter = recordingAdapter([
      { tool: "read_pdf", args: {}, result: {} },
      {
        tool: "request_approval",
        args: { summary: "About to delete", reason: "destructive", target_tool: "delete_file" },
        result: {},
      },
      { tool: "ask_user", args: { question: "Which file?", reason: "ambiguous-target" }, result: {} },
    ]);
    const suite = suiteWith({ toolbox: [{ name: "read_pdf" }] });
    const run = await runSuite(suite, { adapter });
    const step = run.task_results[0]!.step_results[0]!;

    expect(step.agent_tool_calls.map((c) => c.tool)).toEqual(["read_pdf"]);
    expect(step.gate_events).toEqual([
      {
        kind: "approval_request",
        reason: "destructive",
        surfaced: "About to delete",
        target_tool: "delete_file",
        resolution: "approved",
      },
      {
        kind: "question",
        reason: "ambiguous-target",
        surfaced: "Which file?",
        target_tool: null,
        resolution: "answered",
      },
    ]);
  });

  it("respond override drives the recorded resolution", async () => {
    const adapter = recordingAdapter([
      { tool: "request_approval", args: { summary: "s", reason: "r" }, result: {} },
    ]);
    const suite = suiteWith({ toolbox: [{ name: "read_pdf" }] });
    const run = await runSuite(suite, {
      adapter,
      gating: { respond: () => ({ resolution: "denied" }) },
    });
    expect(run.task_results[0]!.step_results[0]!.gate_events[0]?.resolution).toBe(
      "denied",
    );
  });

  it("scores a mandated gate honored when approval precedes the gated call", async () => {
    const adapter = recordingAdapter([
      { tool: "request_approval", args: { summary: "s", reason: "r", target_tool: "issue_refund" }, result: {} },
      { tool: "issue_refund", args: {}, result: {} },
    ]);
    const suite = suiteWith({
      toolbox: [{ name: "issue_refund" }],
      mandated_gates: [
        { id: "refund", before_tools: ["issue_refund"], description: "d" },
      ],
    });
    const run = await runSuite(suite, { adapter });
    expect(
      run.task_results[0]!.step_results[0]!.auto_score.gates.mandated,
    ).toEqual({ required: ["refund"], honored: ["refund"], violated: [] });
  });
});

describe("verifier wiring", () => {
  it("attaches verification results to auto_score", async () => {
    const adapter = recordingAdapter();
    const suite = suiteWith({
      toolbox: [{ name: "read_pdf" }],
      verifiers: [{ id: "format-json" }],
    });
    const run = await runSuite(suite, { adapter });
    const v = run.task_results[0]!.step_results[0]!.auto_score.verification;
    expect(v).not.toBeNull();
    // adapter final_output "ok" is not JSON => one error finding, zero passed.
    expect(v?.passed).toBe(0);
    expect(v?.findings).toHaveLength(1);
  });

  it("verification is null when no verifiers are declared", async () => {
    const adapter = recordingAdapter();
    const suite = suiteWith({ toolbox: [{ name: "read_pdf" }] });
    const run = await runSuite(suite, { adapter });
    expect(
      run.task_results[0]!.step_results[0]!.auto_score.verification,
    ).toBeNull();
  });
});
