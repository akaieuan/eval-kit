# eval-kit trace + scoring protocol — schema spec

This document is the **narrative spec** for the eval-kit data contract. The machine-readable contract lives in [`schemas/v1/`](../schemas/) as JSON Schema files. The TypeScript implementation in [`packages/core/src/schema.ts`](../packages/core/src/schema.ts) is the reference implementation of this spec; any conformant implementation in any language is a first-class producer.

## Why schema-first

eval-kit is a protocol with a reference implementation, not a framework you adopt. The protocol is the small surface that survives — adapters, runners, dashboards, and exporters can all change; the artifacts they exchange cannot.

Concretely, this means:

- A Python runner that emits a conformant `run.json` is a valid eval-kit producer. The dashboard will score it. `eval-kit diff` will compare it.
- The JSON Schemas in [`schemas/v1/`](../schemas/) are **committed to the repo** so reviewers can see the contract without running the build.
- The schema version is **independent of the package version**. `@eval-kit/core@0.3.x` and `@eval-kit/core@0.4.x` both produce `schema_version: "1.0.0"` artifacts.

## Versioning policy

```
schema_version  →  major.minor.patch   (e.g. "1.0.0")
package version →  semver across @eval-kit/*  (e.g. "0.3.1")
suite version   →  semver per suite           (e.g. "0.1.0")
```

Three independent version axes. Don't conflate them.

| Change | Schema bump | Package bump |
|---|---|---|
| Add an optional field | patch | minor |
| Add a required field | major | major |
| Add a Dimension enum value | major | minor |
| Rename a field | major | major |
| Change semantics of an existing field | major | major |
| Pure bug fix in tier-1 scoring | none | patch |
| Add a new adapter | none | minor |

Full policy lives in [COMPATIBILITY.md](./COMPATIBILITY.md).

## The five artifact shapes

```
                            ┌─────────────────┐
human-authored YAML  ─────▶ │   EvalSuite     │  schemas/v1/eval-suite.schema.json
                            └────────┬────────┘
                                     │ runSuite(suite, { adapter })
                                     ▼
                            ┌─────────────────┐
                            │      Run        │  schemas/v1/run.schema.json
                            │ (auto-scored)   │
                            └────────┬────────┘
                                     │ human review
                                     ▼
                            ┌─────────────────┐
                            │   StepScore[]   │  schemas/v1/step-score.schema.json
                            └────────┬────────┘
                                     │ mergeScores(run, scores)
                                     ▼
                            ┌─────────────────┐
                            │   ScoredRun     │  schemas/v1/scored-run.schema.json
                            └─────────────────┘
                                     │
                              eval-kit diff / ci / export
```

`Dimension` is referenced from `EvalSuite.dimensions_in_scope`, `EvalStep.scoring_hints.dimensions`, and `StepScore.dimensions`. It is the only artifact shared by suite-author, runner, and scorer.

## Field-by-field — `EvalSuite`

```jsonc
{
  "schema_version": "1.0.0",          // optional in v1, required in v2+
  "suite": {
    "id": "research-agent-v1",        // stable identifier
    "version": "0.1.0",               // suite content version (independent)
    "target_agent_type": "research-agent",
    "dimensions_in_scope": [
      "explainability", "calibration", "collaborative_performance"
    ],
    "tasks": [/* EvalTask[] */]
  }
}
```

**`target_agent_type` is generic, not a product name.** "research-agent" is correct; "claude-sonnet-4-5" is not. The seed suite was deliberately scrubbed of product-specific identifiers (see [BRIEF.md §13](./BRIEF.md)) — this field carries that discipline forward.

**`dimensions_in_scope` is the suite-level allow-list.** Per-step `scoring_hints.dimensions` narrows further but cannot widen. A reviewer scoring a step can only assign scores for dimensions in both sets.

## Field-by-field — `EvalTask`

```jsonc
{
  "id": "task-001-superdeterminism",
  "initial_purpose": "Writing a paper with AI that argues a specific claim",
  "overall_goal": "Collect papers, analyze, build a knowledge base of notes…",
  "is_distraction": false,            // see below
  "context_items": [/* ContextItem[] */],
  "steps": [/* EvalStep[]; 1-9 */],
  "notes_on_observed_runs": "Agent did well until step 4 — looped during canvas creation."
}
```

**`is_distraction: true` is the most important field in the schema.** A distractor task is one where the *correct* agent behavior is refusal — future-dated papers, unverifiable claims, out-of-scope requests. The auto-scorer flips its scoring for these tasks: compliance is failure, refusal is success.

**`notes_on_observed_runs` is what makes the suite real.** Every seed-suite task carries the actual observation that motivated it. Reviewers scoring the step see what failure mode to watch for.

**`steps` is bounded 1-9** because ARC-style multi-step research workflows max out around this length empirically. The hard cap prevents test-suite bloat from sneaking in.

## Field-by-field — `Run`

```jsonc
{
  "schema_version": "1.0.0",
  "suite_id": "research-agent-v1",
  "suite_version": "0.1.0",
  "run_id": "ad2ca26b-2c4b-4244-9530-fd6882d7ee63",
  "started_at": "2026-05-08T14:31:22.114Z",
  "ended_at":   "2026-05-08T14:32:01.882Z",
  "adapter": {
    "name": "anthropic",              // or "openai" | "http" | "mock" | custom
    "model": "claude-sonnet-4-5",
    "config": { /* opaque; documents what was run */ }
  },
  "task_results": [/* TaskResult[] */]
}
```

**`adapter.config` is opaque to the schema.** Adapter-specific (temperature, max_tokens, tool_choice, etc.). It is included so a reviewer scanning a run can answer "what exactly was this run?" without consulting external configuration.

**`run_id` is stable.** A re-scoring of the same run does not change `run_id`; only the scored-run artifact gains/changes `score` fields.

## Field-by-field — `StepResult`

```jsonc
{
  "step_n": 1,
  "agent_tool_calls": [
    { "tool": "read_pdf",            "args": { "ref": "@source:..." }, "result": { "ok": true } },
    { "tool": "take_detailed_notes", "args": { "n": 10 },              "result": { "ok": true } }
  ],
  "agent_final_output": "The paper [@source:...] is titled \"…\" by …",
  "latency_ms": 4218,
  "auto_score": {
    "tool_match": true,               // bool | "partial"
    "distraction_caught": null        // bool | null (null when !task.is_distraction)
  }
}
```

**`tool_match` is three-state, not boolean.** `"partial"` is emitted only when `scoring_hints.tool_match === "subset"` and some-but-not-all expected tools were called. Consumers (CI gate, diff, aggregation) MUST treat `"partial"` as distinct from both `true` and `false`.

**`distraction_caught` is null when not applicable.** Only populated for tasks with `is_distraction: true`. The heuristic: hedge-phrase regex (`"can't verify"`, `"no sources found"`, `"future-dated"`) OR empty tool-call set. Documented in [`packages/core/src/scoring.ts`](../packages/core/src/scoring.ts).

## Field-by-field — `StepScore`

```jsonc
{
  "step_n": 1,
  "tool_match": true,                 // mirrored from auto_score; carried so consumers don't need to join
  "golden_truth": 3,                  // 0|1|2|3|null  (null = unreviewed)
  "distraction_caught": null,
  "dimensions": {
    "explainability": 3,              // present only if scored
    "calibration":    2
  },
  "reviewer_notes": "Names correct; one of the 10 notes is borderline-paraphrased from the abstract.",
  "reviewer_id": "ieuan",             // v0.4 extends to multi-reviewer
  "reviewed_at": "2026-05-08T15:01:44.000Z",
  "pre_filled": false,                // see "Tier 2 / Tier 3 contract" below
  "pre_fill_confidence": 0.84         // present only when pre_filled was true at some point
}
```

### The `pre_filled` invariant

`pre_filled: true` means the score was drafted by the tier-2 LLM pre-fill and has not been touched by a human. **Any human edit to any field of a pre-filled score MUST flip `pre_filled` to false.** This invariant is the operational form of the "humans score, not LLMs" guardrail. Consumers can rely on `pre_filled: false` meaning "a human owns this verdict."

`pre_fill_confidence` survives the flip — it's a historical record. If you need to know whether a score *was ever* pre-filled, check whether `pre_fill_confidence` is present.

## Field-by-field — `ScoredRun`

Identical shape to `Run`, with each `StepResult` extended:

```jsonc
{
  ...                                  // all Run fields
  "task_results": [{
    "task_id": "task-001-superdeterminism",
    "step_results": [{
      ...,                             // all StepResult fields
      "score": StepScore | null        // null = step not yet reviewed
    }]
  }]
}
```

A `ScoredRun` with all `score === null` is valid — equivalent to a `Run`. A run becomes "scored" the moment any step gets a non-null score.

## Aggregation semantics

When computing suite-level statistics from a `ScoredRun`:

- **`tool_match_rate`** counts every step. `"partial"` contributes 0.5.
- **`distraction_detection_rate`** counts only steps where `task.is_distraction === true`. A `null` `distraction_caught` (which should be impossible for distractor tasks but is technically representable) does not contribute.
- **`golden_truth_pass_rate`** counts only steps with `score !== null` (i.e. human-reviewed). Pass threshold defaults to `≥ 2`.
- **`dimension_means`** count only steps where the specific dimension was scored. A reviewer who scored 3 of 5 in-scope dimensions for a step contributes to 3 means, not 5.

The aggregation is implemented in [`packages/core/src/scoring.ts → aggregateScoredRun`](../packages/core/src/scoring.ts). Any conformant aggregator must produce identical results on identical input — drift here means the contract was broken.

## Forward compatibility

The reference implementation accepts:

- Unknown top-level fields (forward-compat with v2 additions). Validators that re-emit artifacts MUST preserve unknown fields.
- Missing `schema_version` (interpreted as v1). v2 will make this required and treat absence as a hard failure.
- Unknown `Dimension` enum values are a **hard failure**. The enum is closed because aggregation correctness depends on it.

## Related docs

- [`schemas/v1/*.schema.json`](../schemas/) — machine-readable contract
- [`schemas/README.md`](../schemas/README.md) — schema directory layout + regeneration
- [`docs/COMPATIBILITY.md`](./COMPATIBILITY.md) — semver + schema-version policy
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — how the artifacts flow through the system
- [`packages/core/src/schema.ts`](../packages/core/src/schema.ts) — Zod reference implementation
- [`packages/core/src/scoring.ts`](../packages/core/src/scoring.ts) — aggregation reference implementation
