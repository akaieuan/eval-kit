# Bridge: OpenAI evals → eval-kit

This example imports JSONL output from [`OpenAI evals`](https://github.com/openai/evals) and produces an eval-kit-conformant `Run` artifact for human scoring.

## Why bridge

OpenAI evals is a broad, well-maintained eval registry with strong auto-grading primitives. Its scoring story is judge-model or programmatic — neither captures the dimension-level human verdict eval-kit is built around. The bridge lets a team keep their OpenAI evals investment for auto-grading while running a human review pass for the dimensions auto-scoring can't reach.

## Quickstart

```bash
# 1. Run an OpenAI eval as usual
oaieval gpt-5 my-eval

# 2. Find the JSONL log
ls /tmp/evallogs/   # e.g. 2026-05-08T12:34:56_my-eval_gpt-5.jsonl

# 3. Import into eval-kit
node examples/with-openai-evals/import.mjs \
  --input /tmp/evallogs/2026-05-08T12-34-56_my-eval_gpt-5.jsonl \
  --suite-id research-agent-v1 \
  --out runs/imported-from-openai-evals.json

# 4. Score it
pnpm --filter @eval-kit/dashboard dev
```

## Field mapping

OpenAI evals JSONL is a stream of events keyed by `sample_id`. The importer groups events by sample, picks the relevant ones, and emits a `Run`.

| OpenAI evals event | eval-kit field |
|---|---|
| `spec.eval_name` | `suite_id` (or override via `--suite-id`) |
| `spec.model_name` | `adapter.model` |
| `spec.run_id` | `adapter.config.openai_evals_run_id` |
| `sampling.sample_id` | `task_id` |
| `sampling.prompt` | source for `agent_final_output` context (not directly mapped) |
| `sampling.sampled` | `agent_final_output` |
| `match.expected` / `match.picked` | discarded — eval-kit re-scores from raw outputs |
| `created_at` | `started_at` / `ended_at` |

OpenAI evals doesn't have a structured tool-call concept at the record level (it's mostly text-in / text-out grading). The importer emits an empty `agent_tool_calls` array unless the sampled output is JSON containing a `tool_calls` field — in which case those are pulled into the run.

## What this example provides

| File | Purpose |
|---|---|
| `import.mjs` | Standalone Node script that converts JSONL events to an eval-kit `Run` |
| `README.md` | This file |

## Limitations

- **Single-turn shape:** OpenAI evals are predominantly single-turn. The importer emits one step per sample. Multi-step OpenAI evals exist but are uncommon — for those, pre-process to split into steps before import.
- **Tool calls:** OpenAI evals doesn't surface tool calls as structured events. If your eval uses function-calling, parse the sampled text yourself before import.
- **Bulk runs:** JSONL files can be large. The importer reads line-by-line, which scales to single-digit GB without trouble.

## Status

Reference implementation. Considered Category 2 (within existing scope — see [`docs/GOVERNANCE.md`](../../docs/GOVERNANCE.md)). Improvements via PR welcomed.

## Related

- [OpenAI evals repo](https://github.com/openai/evals)
- [`docs/INTEGRATIONS.md`](../../docs/INTEGRATIONS.md) — the full integration story
- [`docs/SCHEMA.md`](../../docs/SCHEMA.md) — the contract this bridge satisfies
- [`schemas/v1/run.schema.json`](../../schemas/v1/run.schema.json) — machine-readable contract
