import { z } from "zod";
import type { ContextItem, EvalStep, EvalTask, Finding } from "../schema.js";

/**
 * A context item whose source text is inlined — the only kind content-grounded
 * verifiers can check against. `ContextItem.content` is optional in the schema;
 * `ResolvedContext` narrows it to present.
 */
export type ResolvedContext = ContextItem & { content: string };

export interface VerifierInput {
  output: string;
  step: EvalStep;
  task: EvalTask;
  context: ResolvedContext[];
  /**
   * Verifier params from the suite (`scoring_hints.verifiers[].params`), passed
   * through opaquely. Each verifier validates its own params with zod. (The
   * design's `VerifierInput` omitted this; params must reach `verify` somehow,
   * so they ride here.)
   */
  params: Record<string, unknown>;
}

export interface Verifier {
  id: string;
  description: string;
  /** Pure, deterministic, no IO. */
  verify(input: VerifierInput): Finding[];
}

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Output must parse as JSON. */
export const formatJsonVerifier: Verifier = {
  id: "format-json",
  description: "The agent's output must parse as JSON.",
  verify({ output }) {
    try {
      JSON.parse(output.trim());
      return [];
    } catch (err) {
      return [
        {
          verifier: "format-json",
          severity: "error",
          message: `Output is not valid JSON: ${(err as Error).message}`,
        },
      ];
    }
  },
};

/** Each named section/heading/label must be present in the output. */
export const requiredSectionsVerifier: Verifier = {
  id: "required-sections",
  description: "Each named section must appear in the output.",
  verify({ output, params }) {
    const { sections } = z
      .object({ sections: z.array(z.string()) })
      .parse(params);
    const hay = output.toLowerCase();
    return sections
      .filter((s) => !hay.includes(s.toLowerCase()))
      .map((s) => ({
        verifier: "required-sections" as const,
        severity: "error" as const,
        message: `Missing required section: ${s}`,
      }));
  },
};

/**
 * Every double-quoted passage of >= minWords in the output must appear verbatim
 * (whitespace-normalized) in some context item's content. Skips (returns [])
 * when no context has content — grounding is only meaningful with sources.
 */
export const quoteGroundingVerifier: Verifier = {
  id: "quote-grounding",
  description:
    "Every long double-quoted passage must appear verbatim in a source.",
  verify({ output, context, params }) {
    const { minWords } = z
      .object({ minWords: z.number().default(5) })
      .parse(params);
    const sources = context.map((c) => normalizeWs(c.content));
    if (sources.length === 0) return [];

    const findings: Finding[] = [];
    const re = /"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(output)) !== null) {
      const quote = m[1] ?? "";
      if (quote.trim().split(/\s+/).filter(Boolean).length < minWords) continue;
      const norm = normalizeWs(quote);
      if (sources.some((s) => s.includes(norm))) continue; // grounded
      findings.push({
        verifier: "quote-grounding",
        severity: "error",
        message: `Quote not found in any source: "${quote}"`,
        span: { start: m.index, end: m.index + m[0].length },
      });
    }
    return findings;
  },
};

const registry = new Map<string, Verifier>();

export function registerVerifier(v: Verifier): void {
  registry.set(v.id, v);
}

export function getVerifier(id: string): Verifier {
  const v = registry.get(id);
  if (!v) {
    const known = [...registry.keys()].join(", ") || "(none)";
    throw new Error(`Unknown verifier: "${id}". Registered: ${known}.`);
  }
  return v;
}

export function listVerifiers(): string[] {
  return [...registry.keys()];
}

export const BUILT_IN_VERIFIERS: Verifier[] = [
  formatJsonVerifier,
  requiredSectionsVerifier,
  quoteGroundingVerifier,
];
for (const v of BUILT_IN_VERIFIERS) registerVerifier(v);

/**
 * Run every verifier referenced by a step against its output. Returns null when
 * the step declares no verifiers. `passed` counts verifiers that produced no
 * error-severity finding.
 */
export function runStepVerifiers(
  step: EvalStep,
  task: EvalTask,
  output: string,
): { passed: number; findings: Finding[] } | null {
  const refs = step.scoring_hints.verifiers;
  if (refs.length === 0) return null;
  const context = task.context_items.filter(
    (c): c is ResolvedContext => typeof c.content === "string",
  );
  const findings: Finding[] = [];
  let passed = 0;
  for (const ref of refs) {
    const found = getVerifier(ref.id).verify({
      output,
      step,
      task,
      context,
      params: ref.params,
    });
    findings.push(...found);
    if (!found.some((f) => f.severity === "error")) passed += 1;
  }
  return { passed, findings };
}
