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
});
export type ContextItem = z.infer<typeof ContextItem>;

export const ScoringHints = z
  .object({
    tool_match: z.enum(["strict", "subset", "any"]).default("subset"),
    golden_truth_rubric: z.enum(["pass_fail", "0-3"]).default("0-3"),
    dimensions: z.array(Dimension).default([]),
  })
  .default({});
export type ScoringHints = z.infer<typeof ScoringHints>;

export const EvalStep = z.object({
  n: z.number().int().positive(),
  prompt: z.string(),
  expected_tools: z.array(z.string()).default([]),
  golden_truth: z.string(),
  scoring_hints: ScoringHints,
});
export type EvalStep = z.infer<typeof EvalStep>;

export const EvalTask = z.object({
  id: z.string(),
  initial_purpose: z.string(),
  overall_goal: z.string(),
  is_distraction: z.boolean().default(false),
  context_items: z.array(ContextItem).default([]),
  steps: z.array(EvalStep).min(1).max(9),
  notes_on_observed_runs: z.string().optional(),
});
export type EvalTask = z.infer<typeof EvalTask>;

export const EvalSuite = z.object({
  suite: z.object({
    id: z.string(),
    version: z.string(),
    description: z.string(),
    target_agent_type: z.string(),
    dimensions_in_scope: z.array(Dimension),
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

export const AutoScore = z.object({
  tool_match: z.union([z.boolean(), z.literal("partial")]),
  distraction_caught: z.boolean().nullable(),
});
export type AutoScore = z.infer<typeof AutoScore>;

export const StepResult = z.object({
  step_n: z.number().int().positive(),
  agent_tool_calls: z.array(ToolCall),
  agent_final_output: z.string(),
  latency_ms: z.number().nonnegative(),
  auto_score: AutoScore,
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
  suite_id: z.string(),
  suite_version: z.string(),
  run_id: z.string(),
  started_at: z.string(),
  ended_at: z.string(),
  adapter: AdapterInfo,
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
