import { describe, expect, it } from "vitest";
import type { EvalStep, EvalTask } from "../schema.js";
import {
  getVerifier,
  listVerifiers,
  registerVerifier,
  runStepVerifiers,
  type ResolvedContext,
  type Verifier,
} from "./index.js";

function makeStep(verifierIds: Array<{ id: string; params?: object }> = []): EvalStep {
  return {
    n: 1,
    prompt: "p",
    expected_tools: [],
    golden_truth: "g",
    scoring_hints: {
      tool_match: "subset",
      golden_truth_rubric: "0-3",
      dimensions: [],
      verifiers: verifierIds.map((v) => ({ id: v.id, params: v.params ?? {} })),
    },
    blockers: [],
  };
}

function makeTask(content?: string): EvalTask {
  return {
    id: "t",
    initial_purpose: "",
    overall_goal: "",
    is_distraction: false,
    context_items: content
      ? [{ type: "text", label: "src", ref: "@s", content }]
      : [],
    mandated_gates: [],
    steps: [makeStep()],
  };
}

const ctx = (content: string): ResolvedContext => ({
  type: "text",
  label: "src",
  ref: "@s",
  content,
});

describe("format-json", () => {
  const v = getVerifier("format-json");
  it("passes on valid JSON", () => {
    expect(v.verify({ output: '{"a":1}', step: makeStep(), task: makeTask(), context: [], params: {} })).toEqual([]);
  });
  it("errors on invalid JSON", () => {
    const f = v.verify({ output: "not json", step: makeStep(), task: makeTask(), context: [], params: {} });
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe("error");
  });
});

describe("required-sections", () => {
  const v = getVerifier("required-sections");
  const base = { step: makeStep(), task: makeTask(), context: [] };
  it("passes when all sections present (case-insensitive)", () => {
    const f = v.verify({ output: "## Summary\n## risks\n", ...base, params: { sections: ["Summary", "Risks"] } });
    expect(f).toEqual([]);
  });
  it("errors per missing section", () => {
    const f = v.verify({ output: "## Summary only", ...base, params: { sections: ["Summary", "Risks", "Next Steps"] } });
    expect(f).toHaveLength(2);
    expect(f.map((x) => x.severity)).toEqual(["error", "error"]);
  });
  it("throws on malformed params (validated by zod)", () => {
    expect(() => v.verify({ output: "x", ...base, params: {} })).toThrow();
  });
});

describe("quote-grounding", () => {
  const v = getVerifier("quote-grounding");
  const source = ctx("The mitochondria is the powerhouse of the cell, as every textbook says.");

  it("grounds a verbatim quote", () => {
    const f = v.verify({
      output: 'It states "the powerhouse of the cell" clearly.',
      step: makeStep(),
      task: makeTask(),
      context: [source],
      params: {},
    });
    expect(f).toEqual([]);
  });

  it("flags a quote not in any source (with a span)", () => {
    const f = v.verify({
      output: 'It claims "quantum tunnelling drives ATP synthesis directly".',
      step: makeStep(),
      task: makeTask(),
      context: [source],
      params: {},
    });
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe("error");
    expect(f[0]?.span).toBeDefined();
  });

  it("ignores short quotes below minWords", () => {
    const f = v.verify({
      output: 'A "short quote" here.',
      step: makeStep(),
      task: makeTask(),
      context: [source],
      params: {},
    });
    expect(f).toEqual([]);
  });

  it("skips (returns []) when no context has content", () => {
    const f = v.verify({
      output: 'It claims "quantum tunnelling drives ATP synthesis directly".',
      step: makeStep(),
      task: makeTask(),
      context: [],
      params: {},
    });
    expect(f).toEqual([]);
  });
});

describe("registry", () => {
  it("lists the three built-ins", () => {
    const ids = listVerifiers();
    expect(ids).toEqual(
      expect.arrayContaining(["format-json", "required-sections", "quote-grounding"]),
    );
  });

  it("throws on an unknown id", () => {
    expect(() => getVerifier("does-not-exist")).toThrow(/Unknown verifier/);
  });

  it("registerVerifier makes a custom verifier resolvable", () => {
    const custom: Verifier = { id: "always-warn", description: "test", verify: () => [{ verifier: "always-warn", severity: "warn", message: "hi" }] };
    registerVerifier(custom);
    expect(getVerifier("always-warn")).toBe(custom);
  });
});

describe("runStepVerifiers", () => {
  it("null when the step declares no verifiers", () => {
    expect(runStepVerifiers(makeStep(), makeTask(), "anything")).toBeNull();
  });

  it("runs declared verifiers and counts passes (error findings fail)", () => {
    const step = makeStep([
      { id: "format-json" },
      { id: "required-sections", params: { sections: ["Summary"] } },
    ]);
    const r = runStepVerifiers(step, makeTask(), "plain prose, no headings at all");
    expect(r).not.toBeNull();
    expect(r?.passed).toBe(0);
    expect(r?.findings.length).toBe(2);
  });

  it("resolves ContextItem.content for grounding verifiers", () => {
    const step = makeStep([{ id: "quote-grounding" }]);
    const task = makeTask("hello world this is the grounded source text");
    const r = runStepVerifiers(step, task, 'quoting "this is the grounded source" here');
    expect(r?.passed).toBe(1);
    expect(r?.findings).toEqual([]);
  });
});
