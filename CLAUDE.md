# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`eval-kit` is an open-source evaluation framework for **research agents** that measures *collaborative task performance on real human workflows* — not autonomous benchmark completion. The seed task set is ARC-style multi-step research flows with real distractors (future-dated papers, unverifiable claims).

`docs/BRIEF.md` is the authoritative project brief — mission, schema, scoring rubric, seed eval samples, philosophical guardrails. Read it before non-trivial work. The guardrails in §13 are load-bearing (see below). `README.md` is the public pitch + quickstart, not the spec.

## Commands

pnpm workspaces; Node ≥20 (`.nvmrc` pins 20). Run from repo root unless noted.

- `pnpm install` — install workspace deps
- `pnpm build` — `tsup` build across all packages
- `pnpm dev` — parallel watch across packages
- `pnpm test` — `vitest run` across packages
- `pnpm typecheck` — `tsc --noEmit` across packages
- `pnpm lint` — per-package lint (no root linter configured yet)
- `pnpm clean` — remove `dist/` and `node_modules/`

Scoped to one package: `pnpm --filter @eval-kit/core <script>`. Single test file: `pnpm --filter @eval-kit/core exec vitest run path/to/file.test.ts`.

CLI (once `cli.ts` is implemented and built): `eval-kit run <suite.yaml> --adapter <name> --out <run.json>`, `eval-kit review <run.json>`, `eval-kit diff <a.scored.json> <b.scored.json>`.

## Architecture

Monorepo layout is defined in `README.md` §4. Three first-party packages planned; only `@eval-kit/core` exists today.

### `@eval-kit/core` (TypeScript, ESM, built with tsup)

- `src/schema.ts` — **Zod schemas are the source of truth** for every data shape: `EvalSuite` (YAML input) → `Run` (trace output) → `ScoredRun` (after human review). Types are inferred from Zod with `z.infer`; don't hand-write parallel types. `parseSuite`/`parseRun`/`parseScoredRun` are the validation entry points.
- `src/scoring.ts` — two layers:
  - `autoScoreStep` runs at trace time. Computes `tool_match` (`strict` | `subset` | `any` per-step mode) and `distraction_caught` (only set when `task.is_distraction === true`; heuristic is hedge-phrase regex + empty tool calls). `subset` mode returns `"partial"` when some-but-not-all expected tools were called — this three-state value propagates through aggregation.
  - `aggregateScoredRun` rolls up a `ScoredRun` into suite-level metrics. Only reviewed steps (non-null `score`) contribute to `golden_truth_pass_rate` and `dimension_means`; auto metrics count every step.
  - `mergeScores` stitches human `StepScore`s onto a `Run` by `(task_id, step_n)` to produce a `ScoredRun`.
- `src/adapters/` — pluggable agents behind `AgentAdapter { name, model, config, run(input) }`. Input includes `prior_steps` so multi-step tasks can carry state. `createMockAdapter` is the reference implementation (supports `degraded: true` to simulate regressions — used by the acceptance-criteria diff demo). `createAnthropicAdapter` is a stub; wire `@anthropic-ai/sdk` when the real adapter lands.
- Not yet implemented (tsup config references these entries, so `pnpm build` will fail until they exist): `src/index.ts`, `src/runner.ts`, `src/cli.ts`. The runner orchestrates steps against an adapter and emits `run.json`; the CLI wraps run/review/diff with commander + `yaml`.

### `@eval-kit/ui` and `apps/dashboard` (not yet scaffolded)

The dashboard **reuses `@hitl-kit/react` primitives as an npm dependency** (separate shipped repo). Do not vendor, fork, or re-implement HITL primitives here — if one is missing, open an issue in `hitl-kit`. This repo adds only eval-specific surfaces (diff view, 0–3 rubric slider, suite author page). Primitive → surface mapping is in README §8.

### Data flow

`suite.yaml` → `parseSuite` → runner loops tasks×steps against an `AgentAdapter` → `autoScoreStep` attaches an `AutoScore` per step → `run.json` is written. Reviewer opens it in the dashboard, produces `StepScore`s, `mergeScores` emits `run.scored.json`. Diff view compares two scored runs step-by-step.

### Scoring model

Two independent axes per step: (1) auto-scored `tool_match` + `distraction_caught`, (2) human-scored `golden_truth` (0–3) + per-`Dimension` rubric (0–3). `Dimension` enum is fixed: `explainability`, `agency_preservation`, `long_term_capability`, `calibration`, `collaborative_performance`. Per-step `scoring_hints.dimensions` narrows which dimensions apply — not every step scores every dimension.

## Project-specific conventions

- **ESM only.** All imports use explicit `.js` extensions in TypeScript source (e.g. `from "./schema.js"`) — required by the bundler/node ESM setup. Keep this when adding files.
- **`noUncheckedIndexedAccess` is on** (`tsconfig.base.json`). Indexing a map/array yields `T | undefined`; `?? 0` / narrowing is expected.
- **Zod-first schemas.** New persisted shapes go in `schema.ts` with a matching `parseX` helper. Don't introduce parallel TS-only types for data that crosses the run/scored-run boundary.
- **Product-agnostic seed tasks.** The seed eval is being ported from a PDF authored against one specific research agent. **Strip product-specific names and session URLs** when porting — the schema must fit any research agent.

## Philosophical guardrails (README §13)

These prevent scope drift and should push back on suggestions that violate them:

- **Humans score, not LLMs.** LLM-as-judge is explicitly out of v0.1. A future "LLM pre-fill the human accepts/overrides" hook is allowed but must set `pre_filled: true` on the `StepScore`. If LLM-judge becomes the default scorer, the project loses its reason to exist.
- **Real tasks, not synthetic.** Prefer porting observed real workflows over fabricating plausible ones.
- **Multi-step, not single-turn.** The value is step-by-step tool selection and golden-truth checks across a flow.
- **No benchmark marketing.** Aggregate scores are internal signal, not leaderboard fodder — the framework measures qualitative collaborative performance.
