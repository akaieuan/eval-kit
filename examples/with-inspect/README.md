# Bridge: AISI Inspect → eval-kit

This example imports traces from [`UK AISI's Inspect`](https://inspect.ai-safety-institute.org.uk/) and produces an eval-kit-conformant `Run` artifact. The reviewer scores it in eval-kit's dashboard with the structured 5-dimension rubric Inspect doesn't ship.

## Why bridge

Inspect is excellent at auto-scoring (model graders, exact-match, regex, etc.) and is becoming the de-facto standard for safety evaluations. What it doesn't ship is a structured human-rubric layer for the dimensions auto-scoring can't reach reliably — calibration, agency preservation, collaborative performance. That's eval-kit's role.

The integration pattern: Inspect produces the trace and its auto-grade; eval-kit imports the trace, re-runs its own deterministic tier-1 scoring, and exposes the result to a human reviewer for the dimension-level verdict.

## Quickstart

```bash
# 1. Run an Inspect eval as usual, producing `.eval` log files
inspect eval my_task.py --model anthropic/claude-sonnet-4-5

# 2. Import the resulting log into eval-kit
node examples/with-inspect/import.mjs \
  --input logs/2026-05-08T12-34-56_my-task_anthropic_claude-sonnet-4-5.eval \
  --suite-id research-agent-v1 \
  --out runs/imported-from-inspect.json

# 3. Score it in eval-kit's dashboard
pnpm --filter @eval-kit/dashboard dev
# → http://localhost:3000/runs/<id>
```

## Field mapping

| Inspect | eval-kit |
|---|---|
| Top-level `eval.task` | `suite_id` (or override via `--suite-id`) |
| `eval.task_args.model` | `adapter.model` |
| `samples[].id` | `task_id` |
| `samples[].epoch`, message sequence | flattened into `step_results[].step_n` |
| `samples[].messages[].content` | rolled up into `agent_final_output` per step |
| `samples[].tool_calls[]` | `agent_tool_calls` (renamed: `function` → `tool`) |
| `samples[].scores[]` | discarded — eval-kit re-scores from raw outputs |
| `samples[].metadata.start_time` / `end_time` | `started_at` / `ended_at` |

eval-kit deliberately re-runs its tier-1 auto-score from the raw `tool_calls` + `agent_final_output` rather than trusting Inspect's grader output. This keeps the auto-score contract identical regardless of producer.

## What this example provides

| File | Purpose |
|---|---|
| `import.mjs` | Stand-alone Node script that converts an Inspect `.eval` JSON to an eval-kit `Run` |
| `inspect-trace.types.ts` | Minimal TS types for the subset of Inspect's log format we touch |
| `README.md` | This file |

## Live adapter (for running Inspect from inside eval-kit)

To drive an Inspect task as a single step inside an eval-kit suite — useful when you want eval-kit's multi-step flow to call into Inspect's graders mid-task — wrap `inspect eval` in an `AgentAdapter`:

```ts
import type { AgentAdapter, AgentRunInput, AgentRunOutput } from "@eval-kit/core";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

export function createInspectAdapter(task: string, model: string): AgentAdapter {
  return {
    name: "inspect",
    model,
    config: { task },
    async run(input: AgentRunInput): Promise<AgentRunOutput> {
      const t0 = Date.now();
      // Hand the prompt + prior_steps to Inspect via a generated task file…
      // (omitted — depends on your Inspect task signature)
      const logPath = await runInspectSubprocess(task, model, input);
      const log = JSON.parse(await readFile(logPath, "utf-8"));
      return rollUpInspectLog(log, t0);
    },
  };
}
```

The shape above is illustrative — wire it to your Inspect task's actual signature. eval-kit doesn't ship this adapter as a built-in because Inspect tasks vary too much in shape to standardize.

## Limitations

- **Multi-epoch samples:** Inspect supports multi-epoch evaluation; eval-kit's `step_n` is a single linear sequence. The importer flattens epochs into steps by sequence; if your Inspect task uses epochs for retry-with-noise rather than progression, this mapping may not match your intent.
- **Sample sub-scores:** Inspect's per-criterion sub-scores are dropped on import. eval-kit's human-scored rubric is the replacement layer. If you need the sub-scores in the trace, copy them into `agent_final_output` as a structured prelude.
- **Streaming logs:** the importer reads the full `.eval` JSON into memory. Massive eval runs (thousands of samples) may need a streaming variant — open an issue.

## Status

Reference implementation. Considered Category 2 (within existing scope — see [`docs/GOVERNANCE.md`](../../docs/GOVERNANCE.md)). Improvements via PR welcomed.

## Related

- [Inspect docs](https://inspect.ai-safety-institute.org.uk/)
- [`docs/INTEGRATIONS.md`](../../docs/INTEGRATIONS.md) — the full integration story
- [`docs/SCHEMA.md`](../../docs/SCHEMA.md) — the contract this bridge satisfies
- [`schemas/v1/run.schema.json`](../../schemas/v1/run.schema.json) — machine-readable contract
