import { z } from "zod";

export const Dimension = z.enum([
  "explainability",
  "agency_preservation",
  "long_term_capability",
  "calibration",
  "collaborative_performance",
]);
export type Dimension = z.infer<typeof Dimension>;

export const ContextItem = z.object({
  type: z.enum(["pdf", "url", "text", "image", "canvas", "other"]),
  label: z.string(),
  ref: z.string(),
  /**
   * Inline source text. When present the item is a `ResolvedContext` and
   * content-grounded verifiers (e.g. quote-grounding) can check the agent's
   * output against it. Absent for reference-only items — the dataset seam
   * where a future loader resolves `ref` to text.
   */
  content: z.string().optional(),
});
export type ContextItem = z.infer<typeof ContextItem>;

/**
 * A tool offered to the agent. The suite-level toolbox is the universe of
 * tools available on every step; adapters build tool definitions from these
 * and never see `expected_tools` (which is answer-key only).
 */
export const ToolDecl = z.object({
  name: z.string(),
  description: z.string().optional(), // adapters synthesize one if absent
});
export type ToolDecl = z.infer<typeof ToolDecl>;

/**
 * Reference to a verifier to run against a step's output. `params` is passed
 * through opaquely; each built-in validates its own params with zod.
 */
export const VerifierRef = z.object({
  id: z.string(),
  params: z.record(z.unknown()).default({}),
});
export type VerifierRef = z.infer<typeof VerifierRef>;

export const ScoringHints = z
  .object({
    tool_match: z.enum(["strict", "subset", "any"]).default("subset"),
    golden_truth_rubric: z.enum(["pass_fail", "0-3"]).default("0-3"),
    dimensions: z.array(Dimension).default([]),
    verifiers: z.array(VerifierRef).default([]),
  })
  .default({});
export type ScoringHints = z.infer<typeof ScoringHints>;

/**
 * A step-level discretionary blocker: something missing, ambiguous, or
 * conflicting that a good agent should surface (via `ask_user`) rather than
 * paper over. Scored on precision/recall — judgment, never compliance.
 */
export const Blocker = z.object({
  id: z.string(),
  description: z.string(),
});
export type Blocker = z.infer<typeof Blocker>;

export const EvalStep = z.object({
  n: z.number().int().positive(),
  prompt: z.string(),
  expected_tools: z.array(z.string()).default([]),
  golden_truth: z.string(),
  scoring_hints: ScoringHints,
  blockers: z.array(Blocker).default([]),
  /** Canned answer the runner returns to an `ask_user` gate, for deterministic replay. */
  gate_response: z.string().optional(),
});
export type EvalStep = z.infer<typeof EvalStep>;

/**
 * A task-level mandated gate: a policy that calling any tool in `before_tools`
 * requires prior human approval. Scored pass/fail (compliance), never averaged
 * with discretionary judgment.
 */
export const MandatedGate = z.object({
  id: z.string(),
  before_tools: z.array(z.string()).min(1),
  description: z.string(),
});
export type MandatedGate = z.infer<typeof MandatedGate>;

export const EvalTask = z.object({
  id: z.string(),
  initial_purpose: z.string(),
  overall_goal: z.string(),
  is_distraction: z.boolean().default(false),
  context_items: z.array(ContextItem).default([]),
  mandated_gates: z.array(MandatedGate).default([]),
  steps: z.array(EvalStep).min(1).max(9),
  notes_on_observed_runs: z.string().optional(),
});
export type EvalTask = z.infer<typeof EvalTask>;

/**
 * The version of the trace + scoring protocol these artifacts conform to.
 *
 * One source of truth for the emitters (`runner.ts`), the generated JSON Schema
 * (`scripts/gen-schemas.mjs`) and the docs. Bump per the policy table in
 * `docs/SCHEMA.md`: adding an optional field is a patch, adding a required
 * field or renaming one is a major.
 */
export const SCHEMA_VERSION = "1.0.0";

/**
 * `major.minor.patch`, validated — an unparseable version is worse than none,
 * because a consumer will branch on it. Defaults rather than being optional so
 * every parsed artifact carries a usable value while pre-field artifacts on
 * disk still load.
 */
export const SchemaVersion = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "schema_version must be major.minor.patch")
  .default(SCHEMA_VERSION);

export const EvalSuite = z.object({
  /** See `SCHEMA_VERSION`. Optional in v1; required in v2+. */
  schema_version: SchemaVersion,
  suite: z.object({
    id: z.string(),
    version: z.string(),
    description: z.string(),
    target_agent_type: z.string(),
    dimensions_in_scope: z.array(Dimension),
    toolbox: z.array(ToolDecl).default([]),
    tasks: z.array(EvalTask).min(1),
  }),
});
export type EvalSuite = z.infer<typeof EvalSuite>;

export const ToolCall = z.object({
  tool: z.string(),
  args: z.unknown(),
  result: z.unknown(),
});
export type ToolCall = z.infer<typeof ToolCall>;

/**
 * A recorded gate interaction — the moment control returned to a human. Gate
 * tool calls are extracted here and EXCLUDED from `agent_tool_calls`, keeping
 * tool-match semantics clean (gates are meta-actions, not task actions).
 */
export const GateEvent = z.object({
  kind: z.enum(["approval_request", "question"]),
  reason: z.string(),
  surfaced: z.string(), // the summary/question the human actually saw
  target_tool: z.string().nullable(),
  resolution: z.enum(["approved", "denied", "answered", "unresolved"]),
  /**
   * How many TASK tool calls preceded this gate call in the agent's action
   * sequence. Splitting gate calls out of `agent_tool_calls` otherwise destroys
   * the ordering that mandated-gate compliance is scored on — without this the
   * artifact cannot be re-scored, which makes a recorded run useless as a
   * replayable golden. `null` on artifacts written before this field existed:
   * ordering unknown, so mandated-gate compliance is NOT re-derivable. Defaulting
   * to 0 would have been worse than null — it would silently read as "approved
   * before everything" and manufacture compliance that was never observed.
   */
  task_calls_before: z.number().int().nonnegative().nullable().default(null),
  /**
   * How many gated calls this approval authorizes.
   *
   * `null` means the agent said nothing, which resolves to 1 at scoring
   * time. Kept nullable rather than defaulting to 1 in the schema so the
   * artifact preserves the difference between "the agent said one" and
   * "the agent said nothing". That is a provenance fact a reviewer may
   * want, and collapsing it here would destroy it permanently.
   */
  uses: z.number().int().positive().nullable().default(null),
});
export type GateEvent = z.infer<typeof GateEvent>;

/** A single machine-checkable issue found by a verifier. */
export const Finding = z.object({
  verifier: z.string(),
  severity: z.enum(["error", "warn"]),
  message: z.string(),
  span: z.object({ start: z.number(), end: z.number() }).optional(),
});
export type Finding = z.infer<typeof Finding>;

/** Mandated-gate compliance for a step. Pass/fail, per gate id. */
export const MandatedGateScore = z.object({
  required: z.array(z.string()), // one entry per gated CALL, not per gate
  honored: z.array(z.string()), // approval named the tool and preceded the call
  violated: z.array(z.string()), // gated call with no eligible approval
  /**
   * Which approval authorized which call. `approvalIndex` indexes the step's
   * `gate_events`. This is what turns "an approval happened before this" into
   * "THIS approval authorized THIS call", which is what the timeline draws.
   */
  pairings: z
    .array(
      z.object({
        callIndex: z.number().int().nonnegative(),
        approvalIndex: z.number().int().nonnegative(),
        gateId: z.string(),
      }),
    )
    .default([]),
});
export type MandatedGateScore = z.infer<typeof MandatedGateScore>;

/** Discretionary blocker handling for a step. Precision/recall, never averaged. */
export const DiscretionaryScore = z.object({
  blockers: z.number(), // declared on this step
  asked: z.number(), // ask_user events
  matched: z.number(), // asks that address a declared blocker
  unprompted: z.number(), // asks on steps with zero blockers (over-asking signal)
});
export type DiscretionaryScore = z.infer<typeof DiscretionaryScore>;

export const AutoScore = z.object({
  tool_match: z.union([z.boolean(), z.literal("partial")]),
  distraction_caught: z.boolean().nullable(),
  /** Did the agent call task tools anyway on a distraction? null on non-distractions. */
  distraction_acted: z.boolean().nullable().default(null),
  gates: z
    .object({
      mandated: MandatedGateScore.nullable(), // null when task declares no mandated gates
      discretionary: DiscretionaryScore.nullable(), // null when step has no blockers AND no asks
    })
    .default({ mandated: null, discretionary: null }),
  verification: z
    .object({ passed: z.number(), findings: z.array(Finding) })
    .nullable()
    .default(null),
});
export type AutoScore = z.infer<typeof AutoScore>;

export const StepResult = z.object({
  step_n: z.number().int().positive(),
  agent_tool_calls: z.array(ToolCall),
  agent_final_output: z.string(),
  latency_ms: z.number().nonnegative(),
  auto_score: AutoScore,
  gate_events: z.array(GateEvent).default([]),
});
export type StepResult = z.infer<typeof StepResult>;

export const TaskResult = z.object({
  task_id: z.string(),
  step_results: z.array(StepResult),
});
export type TaskResult = z.infer<typeof TaskResult>;

export const AdapterInfo = z.object({
  name: z.string(),
  model: z.string(),
  config: z.record(z.unknown()).default({}),
});
export type AdapterInfo = z.infer<typeof AdapterInfo>;

export const Run = z.object({
  /**
   * Which version of the trace + scoring PROTOCOL this artifact conforms to —
   * see `docs/SCHEMA.md`. Deliberately independent of the `@eval-kit/*` package
   * version and of `suite_version`: three axes that must not be conflated.
   *
   * Optional in v1, so artifacts recorded before the field existed parse as
   * "1.0.0". v2 will make it required and treat absence as a hard failure.
   * Same shape as `scoring_model` below, for the same reason.
   */
  schema_version: SchemaVersion,
  suite_id: z.string(),
  suite_version: z.string(),
  run_id: z.string(),
  started_at: z.string(),
  ended_at: z.string(),
  adapter: AdapterInfo,
  /**
   * Which gate-scoring rules produced this run.
   *
   * "v1": one approval covered unlimited gated calls and an untargeted
   * approval covered every gate. "v2": approvals name a tool and carry a
   * budget. Re-scoring a v1 artifact under v2 rules legitimately changes
   * numbers, so a diff across models is a rules change, not a regression,
   * and must not be reported as one.
   */
  scoring_model: z.enum(["v1", "v2"]).default("v1"),
  task_results: z.array(TaskResult),
});
export type Run = z.infer<typeof Run>;

export const RubricScore = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type RubricScore = z.infer<typeof RubricScore>;

export const StepScore = z.object({
  step_n: z.number().int().positive(),
  tool_match: z.union([z.boolean(), z.literal("partial")]),
  golden_truth: RubricScore.nullable(),
  distraction_caught: z.boolean().nullable(),
  dimensions: z.record(Dimension, RubricScore).default({}),
  reviewer_notes: z.string().default(""),
  reviewer_id: z.string(),
  reviewed_at: z.string(),
  pre_filled: z.boolean().default(false),
  /**
   * Confidence (0..1) the LLM pre-fill assigned when drafting this score.
   * Only populated when pre_filled=true. Used by the review-queue triage
   * sort: lower confidence → higher priority for human review.
   */
  pre_fill_confidence: z.number().min(0).max(1).optional(),
});
export type StepScore = z.infer<typeof StepScore>;

export const ScoredStepResult = StepResult.extend({
  score: StepScore.nullable(),
});
export type ScoredStepResult = z.infer<typeof ScoredStepResult>;

export const ScoredTaskResult = z.object({
  task_id: z.string(),
  step_results: z.array(ScoredStepResult),
});
export type ScoredTaskResult = z.infer<typeof ScoredTaskResult>;

export const ScoredRun = Run.extend({
  task_results: z.array(ScoredTaskResult),
});
export type ScoredRun = z.infer<typeof ScoredRun>;

export function parseSuite(input: unknown): EvalSuite {
  return EvalSuite.parse(input);
}

export function parseRun(input: unknown): Run {
  return Run.parse(input);
}

export function parseScoredRun(input: unknown): ScoredRun {
  return ScoredRun.parse(input);
}
