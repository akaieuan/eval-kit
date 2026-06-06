# Integrations

eval-kit is the **human-in-the-loop scoring layer** in an eval stack. It is not a replacement for the auto-scoring eval frameworks your team already uses — it's the layer that adds structured human judgment on top of them.

This document covers how to bridge eval-kit with the most common existing eval frameworks. Each bridge is a small adapter or import shim, not a fork.

## The mental model

```
        ┌────────────────────────────────────────────────────┐
        │  Your existing eval stack                          │
        │  (Inspect, OpenAI evals, LangSmith, W&B Weave…)    │
        │                                                    │
        │   produces traces                                  │
        └────────────────────────┬───────────────────────────┘
                                 │
                                 ▼  conform to schemas/v1/run.schema.json
        ┌────────────────────────────────────────────────────┐
        │  eval-kit                                          │
        │                                                    │
        │  • Tier 1 auto-score (deterministic)               │
        │  • Tier 2 LLM pre-fill (opt-in, flagged)           │
        │  • Tier 3 active triage (priority queue)           │
        │  • Human scoring (the actual product)              │
        │  • Diff, CI gate, SFT/DPO export                   │
        └────────────────────────────────────────────────────┘
```

You keep your existing trace producer. You add eval-kit as the scoring layer. The interface is the `schemas/v1/run.schema.json` contract — any framework that produces a conformant `run.json` plugs in.

## Pattern 1 — import existing traces

For frameworks that already produce a structured trace (Inspect, OpenAI evals, LangSmith), the bridge is a one-time transform from their trace format to eval-kit's `Run` shape.

**Example trace transformers in this repo:**

- [`examples/with-inspect/`](../examples/with-inspect/) — convert AISI Inspect's `.eval` files to eval-kit `Run`
- [`examples/with-openai-evals/`](../examples/with-openai-evals/) — convert OpenAI evals JSONL output to eval-kit `Run`

Each example is a single TypeScript file plus a README. They are intentionally small — the schema is the contract, the bridge is mostly field renaming.

## Pattern 2 — adapter wrapper for live runs

When you want eval-kit to *drive* the agent (not just import traces), implement an `AgentAdapter` that delegates to the upstream framework. This is the path for:

- Running an Inspect task graph as a single step in an eval-kit suite.
- Calling a LangGraph agent from eval-kit's runner.
- Running a custom orchestrator behind the `http` adapter.

The `AgentAdapter` interface is in [`packages/core/src/adapters/types.ts`](../packages/core/src/adapters/types.ts):

```ts
export interface AgentAdapter {
  name: string;
  model: string;
  config: Record<string, unknown>;
  run(input: AgentRunInput): Promise<AgentRunOutput>;
}
```

Reference adapter: [`packages/core/src/adapters/http.ts`](../packages/core/src/adapters/http.ts) — generic POST-to-URL, suitable as a starting point for wrapping any HTTP-exposed orchestrator.

## Bridge: AISI Inspect

[`UK AI Safety Institute's Inspect`](https://inspect.ai-safety-institute.org.uk/) is the closest peer in this space. It is also the most natural integration partner: Inspect's auto-scoring is excellent, but it does not ship a structured human-rubric layer. eval-kit fills that gap.

**Trace import:**

Inspect produces `.eval` log files. The bridge in [`examples/with-inspect/`](../examples/with-inspect/) walks an `.eval` directory and emits one eval-kit `Run` per Inspect task. Field mapping:

| Inspect field | eval-kit field |
|---|---|
| `sample.id` | `task_id` |
| `sample.messages[].content` | rolled up into `agent_final_output` |
| `sample.tool_calls[]` | `agent_tool_calls` |
| `sample.scores[].value` | input to tier-1 auto-score (not directly mapped — eval-kit re-scores from raw outputs) |
| `model` | `adapter.model` |

The reviewer scores the Inspect-produced run in eval-kit's dashboard the same way they'd score an eval-kit-produced run.

**Live adapter:**

Wrap an Inspect task in an `AgentAdapter.run()` that invokes `inspect eval` as a subprocess, parses the resulting `.eval`, and returns the rolled-up step output. Useful for "run Inspect's grader, then score with humans on the dimensions Inspect doesn't cover."

## Bridge: OpenAI evals

[`OpenAI evals`](https://github.com/openai/evals) produces JSONL output. The bridge is a small JSONL → `Run` transform.

**Trace import:**

```bash
# After running an OpenAI eval:
node examples/with-openai-evals/import.mjs \
  --input /tmp/evallogs/2026-05-08T12:34:56_my-eval_anthropic.jsonl \
  --out runs/imported-openai-eval.json
```

The script reads the JSONL, groups records by sample id, and emits a conformant eval-kit `Run`. See [`examples/with-openai-evals/`](../examples/with-openai-evals/) for the exact mapping.

## Bridge: LangSmith

[`LangSmith`](https://docs.langchain.com/langsmith) traces can be exported via their SDK. The pattern is the same as Inspect/OpenAI: write a small importer that maps LangSmith's `Run` (their term, no relation) to eval-kit's `Run`.

No reference impl ships in this repo today (no maintainer-side LangSmith deployment to test against). Contributing one is welcomed; see [GOVERNANCE.md → Category 2](./GOVERNANCE.md).

Suggested file: `examples/with-langsmith/` with the same shape as the existing bridges.

## Bridge: Weights & Biases Weave

[`W&B Weave`](https://weave-docs.wandb.ai/) is a tracing + eval framework with its own scoring concepts. The bridge is bidirectional:

- **Import:** Weave traces → eval-kit Run for human scoring.
- **Export:** eval-kit ScoredRun → Weave eval rows for dashboards in W&B.

No reference impl ships. Same contribution path as LangSmith.

## Bridge: Helicone, Langfuse, Phoenix (Arize)

These are observability-oriented platforms; traces are richer than what eval-kit's `Run` needs. The integration pattern is "select a subset of the trace that corresponds to one eval task" and emit the trimmed view as an eval-kit `Run`.

No reference impl ships. Contribution welcomed; the philosophical constraint is that the imported trace must still be a multi-step research-style flow, not a single-turn LLM call.

## Bridge: your own internal framework

If your team has an internal agent orchestrator that produces structured traces, the bridge pattern is:

1. Pick the eval-kit `Run` schema as the export format (see [`schemas/v1/run.schema.json`](../schemas/v1/run.schema.json)).
2. Emit one `Run` per evaluation session.
3. `eval-kit review` or the dashboard handles the rest.

This is the path most B2B users follow. It avoids a runner rewrite — you keep your orchestrator, eval-kit slots in as the scoring layer.

## What integrations are NOT

A few things eval-kit will not become to "integrate" with X:

- **A trace collection service.** Your existing framework already does this. eval-kit reads the trace, scores it, exports training data.
- **A multi-framework router.** eval-kit does not "pick the best eval framework for your task." Your team picks; eval-kit scores.
- **A judging service.** Even when integrated with LLM-judge frameworks, eval-kit's role is to insert human review between the judge and the verdict.

## Where bridges live

| Bridge | Location | Status |
|---|---|---|
| AISI Inspect | [`examples/with-inspect/`](../examples/with-inspect/) | Reference impl |
| OpenAI evals | [`examples/with-openai-evals/`](../examples/with-openai-evals/) | Reference impl |
| LangSmith | — | Wanted |
| W&B Weave | — | Wanted |
| Helicone / Langfuse / Phoenix | — | Wanted |
| Internal framework | — | Pattern documented above |

Bridges contributed under `examples/with-<name>/` are accepted as Category 2 changes (issue first, then PR). See [GOVERNANCE.md](./GOVERNANCE.md).

## Related docs

- [`schemas/v1/run.schema.json`](../schemas/v1/run.schema.json) — the contract any bridge must satisfy
- [`docs/SCHEMA.md`](./SCHEMA.md) — narrative spec for the contract
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — where eval-kit fits in an eval stack
- [`packages/core/src/adapters/types.ts`](../packages/core/src/adapters/types.ts) — `AgentAdapter` interface for live wrappers
