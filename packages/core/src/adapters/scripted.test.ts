import { describe, expect, it } from "vitest";
import { createScriptedAdapter } from "./scripted.js";
import type { AgentRunInput } from "./types.js";

function input(over: Partial<AgentRunInput> = {}): AgentRunInput {
  return {
    task_id: "t1",
    step_n: 1,
    prompt: "do the thing",
    context: [],
    toolbox: [{ name: "read_pdf" }],
    prior_steps: [],
    ...over,
  };
}

describe("scripted adapter addressing", () => {
  it("returns the script for the (task, step) it was called with", async () => {
    const adapter = createScriptedAdapter({
      script: {
        t1: {
          1: { actions: [{ call: "read_pdf" }], final_output: "first" },
          2: { actions: [{ call: "web_search" }], final_output: "second" },
        },
        t2: { 1: { actions: [], final_output: "other task" } },
      },
    });

    const a = await adapter.run(input({ task_id: "t1", step_n: 1 }));
    const b = await adapter.run(input({ task_id: "t1", step_n: 2 }));
    const c = await adapter.run(input({ task_id: "t2", step_n: 1 }));

    expect(a.tool_calls.map((t) => t.tool)).toEqual(["read_pdf"]);
    expect(a.final_output).toBe("first");
    expect(b.final_output).toBe("second");
    expect(c.tool_calls).toEqual([]);
    expect(c.final_output).toBe("other task");
  });

  it("throws on an unscripted (task, step) and names what IS scripted", async () => {
    const adapter = createScriptedAdapter({
      script: { t1: { 1: { actions: [] } } },
    });
    await expect(adapter.run(input({ step_n: 4 }))).rejects.toThrow(
      /no script for task "t1" step 4/,
    );
    await expect(adapter.run(input({ step_n: 4 }))).rejects.toThrow(
      /\{"t1":\[1\]\}/,
    );
  });

  it("on_unscripted 'silent' yields an empty step instead of throwing", async () => {
    const adapter = createScriptedAdapter({
      script: {},
      on_unscripted: "silent",
    });
    const out = await adapter.run(input());
    expect(out).toEqual({ tool_calls: [], final_output: "", latency_ms: 0 });
  });
});

describe("scripted actions", () => {
  it("preserves interleaving of task calls and gate calls", async () => {
    const adapter = createScriptedAdapter({
      script: {
        t1: {
          1: {
            actions: [
              { call: "read_pdf" },
              { gate: "request_approval", summary: "s", reason: "r" },
              { call: "web_search" },
              { gate: "ask_user", question: "q", reason: "r2" },
            ],
          },
        },
      },
    });
    const out = await adapter.run(input());
    expect(out.tool_calls.map((t) => t.tool)).toEqual([
      "read_pdf",
      "request_approval",
      "web_search",
      "ask_user",
    ]);
  });

  it("emits gate calls with the arg shape the runner reads", async () => {
    const adapter = createScriptedAdapter({
      script: {
        t1: {
          1: {
            actions: [
              {
                gate: "request_approval",
                summary: "About to refund",
                reason: "policy-refund",
                target_tool: "issue_refund",
              },
              { gate: "ask_user", question: "Which order?", reason: "missing" },
            ],
          },
        },
      },
    });
    const out = await adapter.run(input());
    expect(out.tool_calls[0]?.args).toEqual({
      summary: "About to refund",
      reason: "policy-refund",
      target_tool: "issue_refund",
    });
    expect(out.tool_calls[1]?.args).toEqual({
      question: "Which order?",
      reason: "missing",
    });
  });

  it("omits target_tool entirely when the approval is untargeted (blanket)", async () => {
    const adapter = createScriptedAdapter({
      script: {
        t1: { 1: { actions: [{ gate: "request_approval", summary: "s", reason: "r" }] } },
      },
    });
    const out = await adapter.run(input());
    expect(out.tool_calls[0]?.args).toEqual({ summary: "s", reason: "r" });
  });

  it("defaults final_output from the prompt and honours per-step latency", async () => {
    const adapter = createScriptedAdapter({
      script: { t1: { 1: { latency_ms: 42 } } },
      latency_ms: 7,
    });
    const out = await adapter.run(input({ prompt: "summarize it" }));
    expect(out.final_output).toBe("Scripted response to: summarize it");
    expect(out.latency_ms).toBe(42);
  });
});
