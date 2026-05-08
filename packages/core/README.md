# @eval-kit/core

Schema, runner, scoring engine, agent adapters, and CLI for [eval-kit](https://github.com/akaieuan/eval-kit) — the scoring cockpit for research agents.

**Humans score, not LLMs. Real tasks, not synthetic. Multi-step, not single-turn.**

[![npm version](https://img.shields.io/npm/v/@eval-kit/core)](https://www.npmjs.com/package/@eval-kit/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/akaieuan/eval-kit/blob/main/LICENSE)

## Install

```bash
npm install @eval-kit/core
# or
pnpm add @eval-kit/core
```

## 60-second quickstart

```bash
# 1. Scaffold a new eval project
npx @eval-kit/core init my-evals
cd my-evals && npm install

# 2. Run the starter suite against the mock adapter
npx eval-kit run suites/starter.yaml --adapter mock

# 3. Open the dashboard to score the run
git clone https://github.com/akaieuan/eval-kit && cd eval-kit
pnpm install && pnpm --filter @eval-kit/dashboard dev
# → open http://localhost:3000
```

Score each step with `1` / `2` / `3` for golden truth, `j`/`k` to move between steps, `⌘K` for the command palette.

A standalone `npx @eval-kit/dashboard` (no `git clone` needed) ships in v0.4.

## What's in the box

- **Zod schemas** — `EvalSuite`, `EvalTask`, `EvalStep`, `Run`, `ScoredRun`, `StepScore`, `AgentProfile`. Source of truth for every persisted shape; TS types inferred via `z.infer`. Validate inputs with `parseSuite` / `parseRun` / `parseScoredRun`.
- **Runner** — orchestrates a suite against an `AgentAdapter`, attaches `AutoScore` per step, writes `run.json`.
- **Scoring** — two layers. `autoScoreStep` runs at trace time (deterministic tool-match check, distraction heuristic). `aggregateScoredRun` rolls up suite-level metrics from human reviews.
- **Agent adapters** — `createMockAdapter`, `createAnthropicAdapter`, `createOpenAIAdapter`, `createHttpAdapter`. Custom adapters via the `AgentAdapter` interface.
- **YAML agent profiles** — describe an agent (model, system prompt, tools, max iterations) without writing TypeScript. Two seed profiles ship in the main repo.
- **CLI** — `run`, `review`, `diff`, `report`, `init`, `preflight`, `ci`, `export`.

## CLI commands

```bash
eval-kit init <dir>                                  # scaffold a new eval project
eval-kit run <suite.yaml> --adapter <name>           # run a suite
eval-kit review <run.json>                           # opens dashboard prompt
eval-kit diff <a.scored.json> <b.scored.json>        # compare two scored runs
eval-kit report <run.scored.json>                    # aggregate metrics
eval-kit preflight <suite.yaml> --adapter <name>     # dry-run the first step
eval-kit ci <suite.yaml> --adapter <name>            # run + gate on regressions
eval-kit export <run.scored.json> --format sft|dpo   # emit training JSONL
```

## Use it programmatically

```ts
import { parseSuite, runSuite, createAnthropicAdapter } from "@eval-kit/core";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const suite = parseSuite(parse(readFileSync("suites/my-suite.yaml", "utf8")));
const adapter = createAnthropicAdapter({
  model: "claude-sonnet-4-5",
  systemPrompt: "You are a research assistant. Use tools when they help.",
});
const run = await runSuite(suite, adapter);
```

## CI integration

```bash
eval-kit ci suites/my-suite.yaml \
  --adapter anthropic --model claude-sonnet-4-5 \
  --baseline runs/baseline.scored.json \
  --min-tool-match 80 --max-prefilled 50
```

Exits non-zero on **tier-1** regressions (auto-scored). Golden-truth regressions are reported but never fail the build — those need human judgment.

## Status

**v0.3.0** — API stable for the 0.3.x line. Pre-1.0 overall; minor releases (0.4, 0.5) may add new surfaces but won't break public APIs in 0.3.x patches.

## Links

- [Project README](https://github.com/akaieuan/eval-kit#readme) — full pitch and architecture
- [Project brief](https://github.com/akaieuan/eval-kit/blob/main/docs/BRIEF.md) — schema, scoring rubric, philosophical guardrails
- [Roadmap](https://github.com/akaieuan/eval-kit/blob/main/docs/ROADMAP.md) — what's next
- [CHANGELOG](https://github.com/akaieuan/eval-kit/blob/main/CHANGELOG.md)
- [Issues](https://github.com/akaieuan/eval-kit/issues)

## License

MIT
