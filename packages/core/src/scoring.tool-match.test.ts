import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { EvalStep, EvalTask, ScoringHints } from "./schema.js";
import { autoScoreStep } from "./scoring.js";

type Mode = ScoringHints["tool_match"];

function match(
  mode: Mode,
  expected: string[],
  actual: string[],
): boolean | "partial" {
  const step: EvalStep = {
    n: 1,
    prompt: "p",
    expected_tools: expected,
    golden_truth: "g",
    scoring_hints: {
      tool_match: mode,
      golden_truth_rubric: "0-3",
      dimensions: [],
      verifiers: [],
    },
    blockers: [],
  };
  const task: EvalTask = {
    id: "t",
    initial_purpose: "",
    overall_goal: "",
    is_distraction: false,
    context_items: [],
    mandated_gates: [],
    steps: [step],
  };
  return autoScoreStep({ step, task, toolsCalled: actual, finalOutput: "" })
    .tool_match;
}

describe("tool_match matrix", () => {
  const cases: Array<{
    name: string;
    mode: Mode;
    expected: string[];
    actual: string[];
    want: boolean | "partial";
  }> = [
    // strict — exact set equality
    { name: "strict / exact", mode: "strict", expected: ["a", "b"], actual: ["a", "b"], want: true },
    { name: "strict / order-independent", mode: "strict", expected: ["a", "b"], actual: ["b", "a"], want: true },
    { name: "strict / duplicates collapse", mode: "strict", expected: ["a", "b"], actual: ["a", "b", "b"], want: true },
    { name: "strict / superset fails", mode: "strict", expected: ["a", "b"], actual: ["a", "b", "c"], want: false },
    { name: "strict / subset fails", mode: "strict", expected: ["a", "b"], actual: ["a"], want: false },
    { name: "strict / actual-empty fails", mode: "strict", expected: ["a"], actual: [], want: false },
    // subset — actual ⊇ expected; partial for some-but-not-all
    { name: "subset / all present", mode: "subset", expected: ["a", "b"], actual: ["a", "b", "c"], want: true },
    { name: "subset / some present => partial", mode: "subset", expected: ["a", "b"], actual: ["a"], want: "partial" },
    { name: "subset / none present", mode: "subset", expected: ["a", "b"], actual: ["c"], want: false },
    { name: "subset / dup actual still all present", mode: "subset", expected: ["a"], actual: ["a", "a"], want: true },
    { name: "subset / actual-empty", mode: "subset", expected: ["a"], actual: [], want: false },
    // any — at least one
    { name: "any / one present", mode: "any", expected: ["a", "b"], actual: ["a"], want: true },
    { name: "any / none present", mode: "any", expected: ["a", "b"], actual: ["c"], want: false },
    { name: "any / actual-empty", mode: "any", expected: ["a"], actual: [], want: false },
    // expected-empty is always a pass regardless of mode
    { name: "strict / expected-empty", mode: "strict", expected: [], actual: ["x"], want: true },
    { name: "subset / expected-empty", mode: "subset", expected: [], actual: [], want: true },
    { name: "any / expected-empty", mode: "any", expected: [], actual: ["x"], want: true },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(match(c.mode, c.expected, c.actual)).toEqual(c.want);
    });
  }
});

// Non-empty expected/actual tool sets, drawn from a small alphabet so overlaps
// actually happen. These pin the ordering of strength between the three modes.
const toolSet = fc.uniqueArray(fc.constantFrom("a", "b", "c", "d"), {
  minLength: 1,
});

describe("tool_match properties", () => {
  it("strict ⇒ subset (strict is the strongest)", () => {
    fc.assert(
      fc.property(toolSet, toolSet, (expected, actual) => {
        if (match("strict", expected, actual) === true) {
          expect(match("subset", expected, actual)).toBe(true);
        }
      }),
    );
  });

  it("any is weakest (strict-true or subset-truthy ⇒ any-true)", () => {
    fc.assert(
      fc.property(toolSet, toolSet, (expected, actual) => {
        const subset = match("subset", expected, actual);
        if (match("strict", expected, actual) === true || subset !== false) {
          expect(match("any", expected, actual)).toBe(true);
        }
      }),
    );
  });

  it("subset reflexive (calling exactly the expected set passes strict + subset)", () => {
    fc.assert(
      fc.property(toolSet, (expected) => {
        expect(match("subset", expected, expected)).toBe(true);
        expect(match("strict", expected, expected)).toBe(true);
      }),
    );
  });
});
