# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`eval-kit` is an open-source evaluation framework for **research agents** that measures *collaborative task performance on real human workflows* — not autonomous benchmark completion. The unit of measurement is the **gate**: the moment control returns to a human.

Authoritative sources, in order:

- `docs/BRIEF.md` — mission, schema, scoring rubric, seed samples, philosophical guardrails.
- `docs/ARCHITECTURE.md` — system map and layer boundaries.
- `docs/SCHEMA.md` — narrative spec for the data contract.
- `CHANGELOG.md` — what changed and *why*, including corrections to earlier claims.
- `docs/superpowers/specs/` + `docs/superpowers/plans/` — approved designs and their execution plans.
- `.superpowers/sdd/<plan>/progress.md` — the ledger: what actually landed, deferred minors, open questions. **Local-only — `.superpowers/sdd/` is gitignored**, so it exists on the author's machine and not in a clone. Anything from the ledger that outlives the plan belongs in this file, the CHANGELOG, or a spec.

`README.md` is the public pitch + quickstart, not the spec.

## Commands

pnpm workspaces; `.nvmrc` pins Node 20, `engines` allows ≥20. Run from repo root unless noted.

- `pnpm install` / `pnpm build` / `pnpm dev` / `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm clean`

Scoped: `pnpm --filter @eval-kit/core <script>`. Single test: `pnpm --filter @eval-kit/core exec vitest run path/to/file.test.ts`.

CLI: `eval-kit run <suite.yaml> --adapter <name> --out <run.json>`, `eval-kit review <run.json>`, `eval-kit diff <a.scored.json> <b.scored.json>`.

### The five CI gates

`.github/workflows/ci.yml` runs five independent jobs. All five must pass; run them locally before claiming done:

| Gate | Command | Checks |
| --- | --- | --- |
| build/typecheck/test | `pnpm -r build && pnpm -r typecheck && pnpm -r test` | 167 core + 103 ui tests |
| publish-smoke | `pnpm smoke:publish` | packability + `attw` ESM correctness |
| readme-check | `pnpm check:readme` | every fenced block in package READMEs compiles |
| goldens | `pnpm verify:goldens` | re-derives scores from raw evidence and diffs against `goldens/` |
| api-surface | `pnpm api:check` | public type surface matches `api-surface/` snapshot |

**`pnpm -r build` before `pnpm -r typecheck`.** A stale `packages/core/dist` produces phantom `@eval-kit/ui` type errors that are a build-order artifact, not a defect.

**`api:check` reads the working tree via `git status --porcelain`. A *staged* file still counts as dirty — regenerated `api-surface/` must be committed, not just added.**

`verify:goldens` is a **mirror test**: it re-scores from raw evidence rather than trusting the recorded `auto_score`, because comparing the scorer against a number the scorer wrote only proves it agrees with itself. Review golden diffs; never regenerate blindly.

## Architecture

Three published packages + one app. All exist and build.

### `@eval-kit/core` (TypeScript, ESM, tsup)

- `schema.ts` — **Zod schemas are the source of truth** for every shape: `EvalSuite` (YAML in) → `Run` (trace out) → `ScoredRun` (after review). Types via `z.infer`; never hand-write parallel types. Entry points: `parseSuite` / `parseRun` / `parseScoredRun`.
- `scoring.ts` — `autoScoreStep` (trace-time) and `aggregateScoredRun` (roll-up). `mergeScores` stitches human `StepScore`s onto a `Run` by `(task_id, step_n)`.
- `gates.ts` — the two gate tools the **runner injects** (never declared in suites): `request_approval`, `ask_user`. See gate semantics below.
- `runner.ts` — orchestrates tasks × steps against an adapter, emits `run.json`.
- `cli.ts` — commander-based run/review/diff.
- `adapters/` — `AgentAdapter { name, model, config, run(input) }`; input carries `prior_steps` for multi-step state. Ships mock, scripted, anthropic, openai, http.
- `verifiers/` — content-grounded output checks against inlined `ContextItem.content`.
- `agents/`, `init/`, `ci.ts`, `diff.ts`, `export.ts` (SFT/DPO/raw), `rubric.ts`, `loader.ts`.
- `anthropic/` — `extract-task.ts` (suite authoring assist) and `prefill-score.ts` (LLM pre-fill; **sets `pre_filled: true`**, per the guardrail).

### `@eval-kit/ui`

React components for eval-specific surfaces. Built on **Radix + CVA (shadcn pattern)** — there is no `@hitl-kit` dependency anywhere in this repo; the akaOSS/shadcn rebuild (#51) removed it. Do not reintroduce one without a decision.

`src/lib/gates.ts` holds the tested display predicates — `gateTotalsFromSteps`, `isCallAuthorized`. Use them; do not recompute gate authorization inline.

### `apps/dashboard`

Next.js, local-first, 22 routes. The scoring cockpit.

### `@eval-kit/seed-suite`

Three suites: `research-agent-v1`, `coding-agent-v1`, `support-agent-v1`.

### Data flow

`suite.yaml` → `parseSuite` → runner loops tasks×steps against an `AgentAdapter` → `autoScoreStep` attaches an `AutoScore` per step → `run.json`. Reviewer scores in the dashboard → `mergeScores` → `run.scored.json`. Diff compares two scored runs step-by-step.

## Scoring model

Two independent axes per step: (1) auto-scored `tool_match` + `distraction_caught` + gates, (2) human-scored `golden_truth` (0–3) + per-`Dimension` rubric (0–3).

`Dimension` is a fixed enum: `explainability`, `agency_preservation`, `long_term_capability`, `calibration`, `collaborative_performance`. Per-step `scoring_hints.dimensions` narrows which apply.

`tool_match` modes: `strict` | `subset` | `any`. `subset` returns `"partial"` when some-but-not-all expected tools were called — this three-state value propagates through aggregation. `distraction_caught` is only set when `task.is_distraction === true`.

### Gate semantics v2 — the current frame

Design: `docs/superpowers/specs/2026-08-12-gate-semantics-design.md`. Landed via #52.

**An approval names a target and carries a budget.** `GateEvent.target_tool` names the tool; `GateEvent.uses` says how many gated calls it authorizes.

**Under-specified approvals resolve strictly.** Missing `uses` → one use. Missing `target_tool` → **authorizes nothing**. Both fields stay `nullable` rather than defaulting in the schema, so the artifact preserves "the agent said one" vs "the agent said nothing" as a provenance fact.

**Matching rule.** Walk tool calls in index order; for each call tripping a mandated gate, take the **earliest** approval that (1) precedes it (`task_calls_before <= callIndex`), (2) names *the tool actually being called*, (3) has budget left. Decrement, record a pairing. No eligible approval = violation. Matching is on the **tool, not the gate** — approving a refund must not silently authorize a credit.

Earliest-eligible-first is **deterministic by construction**, and that is a requirement, not a preference: a pairing that shifts between runs means two reviewers see different stories from one artifact, and the golden mirror test only works when the operation is exact.

**`required` / `honored` / `violated` hold one entry per gated CALL, not per gate.** So `honored.length + violated.length === required.length`, and one gate id can appear in *both* lists (one call covered, another not).

> This killed a real bug: `GateTimeline` decided authorization with `new Set(mandated.violated).has(gateId)`, so the moment a budget ran out it painted UNAUTHORIZED on the call that *had* been approved. **Always resolve authorization through `pairings` / `isCallAuthorized()`, never set-membership on `violated`.** Inventing a compliance failure is worse than missing one.

**`Run.scoring_model: "v1" | "v2"`**, defaulting `"v1"` for artifacts already on disk. `eval-kit diff` warns across models, because a cross-model difference is a rules change, not a regression.

**`gateCallsFromEvents` throws** when ordering was never captured (`task_calls_before: null`) — it does *not* score everything violated. That claim was wrong in four public surfaces and is corrected in `CHANGELOG.md`. An instrument that cannot see must not report success.

**Two kinds of gate, never averaged.** Mandated (pass/fail per gated call) and discretionary (`blockers`/`asked`/`matched`/`unprompted`) are separate constructs. There is deliberately no combined "gate score", and adding one is a bug. Show counts, not percentages: `11/12 honored` reads as one unauthorized action; `92%` reads as a grade.

## Conventions

- **ESM only.** Explicit `.js` extensions in TS source (`from "./schema.js"`). Keep this when adding files.
- **`noUncheckedIndexedAccess` is on.** Indexing yields `T | undefined`; `?? 0` / narrowing expected.
- **Zod-first.** New persisted shapes go in `schema.ts` with a matching `parseX`. No parallel TS-only types across the run/scored-run boundary.
- **Product-agnostic seed tasks.** Strip product-specific names and session URLs — the schema must fit any research agent.
- **Corrections are dated, not silent.** A public claim that turns out wrong keeps its original text and gains a dated correction note; summary/frontmatter fields may be reworded. Precedent set by the № 008 correction (see ledger).

## Philosophical guardrails (README, "Guardrails")

Push back on suggestions that violate these:

- **Humans score, not LLMs.** LLM-as-judge is out. The pre-fill hook exists (`anthropic/prefill-score.ts`) and is allowed *only* because it sets `pre_filled: true` and a human accepts or overrides. If LLM-judge becomes the default scorer, the project loses its reason to exist.
- **Real tasks, not synthetic.** Prefer porting observed real workflows over fabricating plausible ones.
- **Multi-step, not single-turn.** The value is step-by-step tool selection and golden-truth checks across a flow.
- **No benchmark marketing.** Aggregate scores are internal signal, not leaderboard fodder.

## Working discipline

The gate-semantics plan surfaced these the hard way; they generalize.

- **A guard that nothing invokes is not a guard.** `packages/ui`'s test script was `echo 'no ui tests yet'` — a 98-assertion contrast test written to stop a specific regression had *never run*, in any commit, in CI or locally. Same shape as the bug it was written to catch. When you add a check, verify something executes it.
- **A fixture that only exercises the permissive path hides the bug.** The mock only ever emitted blanket approvals, so no shipped fixture tested targeted approval — which is why unlimited-invocation went unnoticed. Make fixtures exercise the strict path.
- **Verify against the committed tree, not the working tree.** An implementer reported a clean typecheck while the fix was uncommitted; the commit failed CI.
- **Mutation-check the check.** Confirm the test fails when you break the thing it guards.
- **Report the command output.** "Tests pass" without the run is not evidence.
