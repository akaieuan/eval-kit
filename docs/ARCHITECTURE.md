# eval-kit architecture

This document is the **system map**. It explains how the pieces fit together, what each one is responsible for, and where the boundaries are. For the *what* of any single piece, follow the links into source.

For the data contract (the artifacts the pieces exchange), see [`docs/SCHEMA.md`](./SCHEMA.md). For why the project exists at all, see [`docs/BRIEF.md`](./BRIEF.md).

## One-line model

> eval-kit is a **trace + scoring protocol** with a TypeScript reference implementation and a local-first scoring dashboard. The protocol is schema-first, language-agnostic, and versioned independently from the implementation. The product wedge is human-in-the-loop scoring on dimensions LLM-judges can't reach.

## Layers, top down

```
                ┌────────────────────────────────────────────────────────────────┐
                │   apps/dashboard            (Next.js 15, local-first)          │
                │   nine surfaces · scoring cockpit · keyboard-first             │
                └────────────────────────────┬───────────────────────────────────┘
                                             │ imports React components
                                             ▼
                ┌────────────────────────────────────────────────────────────────┐
                │   @eval-kit/ui              (React components on @hitl-kit)    │
                │   eval-specific surfaces only · no HITL primitives re-impl     │
                └────────────────────────────┬───────────────────────────────────┘
                                             │ imports types + parsers
                                             ▼
                ┌────────────────────────────────────────────────────────────────┐
                │   @eval-kit/core            (TS · ESM · Zod-first)             │
                │   schema · runner · scoring · adapters · CLI                   │
                └────────────────────────────┬───────────────────────────────────┘
                                             │ produces / consumes
                                             ▼
                ┌────────────────────────────────────────────────────────────────┐
                │   schemas/v1/*.schema.json  (the protocol — language-agnostic) │
                │   Run · ScoredRun · EvalSuite · StepScore · Dimension          │
                └────────────────────────────────────────────────────────────────┘
                                             ▲
                                             │ also consumed by
                                             │
                ┌────────────────────────────────────────────────────────────────┐
                │   any conformant producer   (Python runner, Go CLI, …)         │
                │   first-class — TS impl is reference, not gate                 │
                └────────────────────────────────────────────────────────────────┘
```

The vertical separation matters. Anything below the schema layer is replaceable. Anything above it depends on the contract. The schema is small on purpose.

## Package boundaries

| Package | Responsibility | Depends on |
|---|---|---|
| [`@eval-kit/core`](../packages/core/) | Schema, runner, scoring, adapters, CLI. The only package that owns the protocol implementation. | `zod`, `commander`, `ansis`, optional `@anthropic-ai/sdk` / `openai` |
| [`@eval-kit/ui`](../packages/ui/) | React components for scoring, reviewing, diffing. Eval-specific surfaces. | `@eval-kit/core` (types only), `@hitl-kit/react` |
| [`@eval-kit/seed-suite`](../packages/seed-suite/) | Three reference YAML suites: research-agent-v1, coding-agent-v1, support-agent-v1. Data only. | none |
| [`apps/dashboard`](../apps/dashboard/) | Next.js 15 dashboard that dogfoods `@eval-kit/ui`. The reference scoring cockpit. | `@eval-kit/core`, `@eval-kit/ui`, `next`, `@anthropic-ai/sdk` for pre-fill |

### Invariants enforced by the boundaries

- **`@eval-kit/core` never imports React.** The runner and scoring engine are platform-agnostic; React is a UI concern.
- **`@eval-kit/ui` never re-implements HITL primitives.** If a primitive is missing, open an issue in [`hitl-kit`](https://github.com/akaieuan/HITL-KIT). Forks here would make the eval-specific layer hard to maintain.
- **`@eval-kit/seed-suite` is data only.** No code. Other suites are expected to follow the same convention.
- **`apps/dashboard` does not duplicate scoring logic.** It calls into core via server actions. Any "should this step pass?" decision lives in core, not in the dashboard.

## Data flow — single run

```
suite.yaml ──▶ parseSuite ──▶ EvalSuite (in-memory)
                                  │
                                  │ for each task × step
                                  ▼
                          ┌────────────────┐
                          │  AgentAdapter  │   anthropic | openai | http | mock | custom-module
                          │     .run()     │
                          └───────┬────────┘
                                  │ AgentRunOutput { tool_calls, final_output, latency_ms }
                                  ▼
                          autoScoreStep ──▶ AutoScore { tool_match, distraction_caught }
                                  │
                                  ▼
                              StepResult
                                  │ rolled up across task × suite
                                  ▼
                              run.json    ◀── deterministic, replayable
                                  │
                                  │ human review (dashboard) or `eval-kit review`
                                  ▼
                          ┌────────────────┐
                          │   StepScore[]  │   tier 1 auto + tier 2 pre-fill + tier 3 triage
                          └───────┬────────┘
                                  │ mergeScores(run, scores)
                                  ▼
                            run.scored.json
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                 ▼                 ▼
         eval-kit diff      eval-kit ci      eval-kit export
         (regression)       (auto-gate)      (sft / dpo / raw JSONL)
```

The arrows are the only places state changes. `prior_steps` is the load-bearing field that carries multi-step state across `AgentAdapter.run()` calls within a task — drop it and multi-step tasks degenerate into N independent single-turn calls.

## Tiered scoring contract

eval-kit's most distinctive design is the explicit tier separation:

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 1 — auto-scoring (deterministic, always on)                   │
│  autoScoreStep() · runs at trace time · cheap · pure function       │
│  Outputs: AutoScore { tool_match, distraction_caught }              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 2 — LLM pre-fill (opt-in per task, flagged on every score)    │
│  Drafts a StepScore. Sets pre_filled: true.                         │
│  Any human edit MUST flip pre_filled to false.                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 3 — active triage (the queue order)                           │
│  Inbox priority weighs:                                             │
│    · pre_fill_confidence (low = surface)                            │
│    · pre-fill vs auto-score disagreement                            │
│    · unreviewed golden-truth for distractor tasks                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  HUMAN — the actual scoring action (the framework's reason to exist)│
└─────────────────────────────────────────────────────────────────────┘
```

Tier 1 is mandatory. Tier 2 and Tier 3 exist to make Tier human's job fast. None of them substitute for the human verdict. See [BRIEF.md §13](./BRIEF.md) for the philosophical commitment behind this layering.

## Where each piece of logic lives

| What | Where |
|---|---|
| Zod schemas (the source of truth) | [`packages/core/src/schema.ts`](../packages/core/src/schema.ts) |
| JSON Schema exports (the protocol contract) | [`schemas/v1/`](../schemas/) |
| Tier 1 auto-scoring | [`packages/core/src/scoring.ts → autoScoreStep`](../packages/core/src/scoring.ts) |
| Aggregation (suite-level stats) | [`packages/core/src/scoring.ts → aggregateScoredRun`](../packages/core/src/scoring.ts) |
| Run orchestration | [`packages/core/src/runner.ts → runSuite`](../packages/core/src/runner.ts) |
| CLI | [`packages/core/src/cli.ts`](../packages/core/src/cli.ts) — 8 subcommands |
| CI gate (tier-1 regression guard) | [`packages/core/src/ci.ts`](../packages/core/src/ci.ts) |
| Training data export (SFT / DPO / raw) | [`packages/core/src/export.ts`](../packages/core/src/export.ts) |
| Adapters | [`packages/core/src/adapters/`](../packages/core/src/adapters/) — anthropic, openai, http, mock |
| YAML agent profiles | [`packages/core/src/agents/`](../packages/core/src/agents/) |
| Tier 2 pre-fill | [`packages/core/src/anthropic/prefill-score.ts`](../packages/core/src/anthropic/) |
| AI-assisted task authoring | [`packages/core/src/anthropic/extract-task.ts`](../packages/core/src/anthropic/) |
| Dashboard surfaces | [`apps/dashboard/src/app/`](../apps/dashboard/) |
| Tier 3 active triage (Inbox ranking) | dashboard server actions consuming `StepScore.pre_fill_confidence` |

## What deliberately does NOT live where you might expect

- **There is no `judge.ts` or `llm-scorer.ts`.** The only LLM-touching code paths are `prefill-score.ts` (opt-in tier 2) and `extract-task.ts` (suite authoring help). LLM-as-judge as default scoring would violate [BRIEF.md §13](./BRIEF.md).
- **There is no global config file.** Adapters carry their own config; the CLI takes flags; the dashboard reads its state from `runs/` on disk. Nothing reads `~/.eval-kit/`.
- **There is no hosted state.** All persistence is file-based, under the user's repo. The dashboard reads/writes `runs/*.json`. No DB, no cache layer, no auth.
- **There is no plugin loader.** Custom adapters are dynamic-imported by path via `--adapter ./path.mjs`. Each consumer's customizations live in their consumer repo, not a registry.

## Runtime characteristics

- **CLI commands are short-lived.** No daemon, no watcher. Each invocation is independent.
- **Dashboard is a Next.js 15 dev/prod server.** Server actions are the persistence path; client components render the inbox and review surfaces. Autosave is debounced per step.
- **Adapters control concurrency.** The runner calls `adapter.run()` sequentially within a task (because `prior_steps` is state). Tasks within a suite run sequentially by default; an adapter can fan out internally.
- **Tier 1 scoring is hot-path pure.** `autoScoreStep` does not touch disk or network. Tier 2 pre-fill is async and explicit.

## Test architecture

| Test type | Where | What it guarantees |
|---|---|---|
| Schema parse-roundtrip | [`packages/core/src/schema.test.ts`](../packages/core/src/schema.test.ts) | Zod schemas parse what they emit. 14 tests. |
| Tier 1 scoring | [`packages/core/src/scoring.test.ts`](../packages/core/src/scoring.test.ts) | `autoScoreStep`, `aggregateScoredRun`, `mergeScores` are correct on canonical inputs. 8 tests. |
| CI matrix | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | All of the above pass on Node 20 + 22 per push. |
| Reference-run verification | [`meta/`](../meta/) (planned) | The "verify the verifier" suite — committed reference inputs + expected scoring outputs. |

## Operational architecture (running it in production CI)

```
GitHub PR
   │
   ▼
GitHub Actions:
   eval-kit ci suites/my-suite.yaml \
     --adapter anthropic --model <pinned> \
     --baseline runs/baseline.scored.json \
     --min-tool-match 80 --max-prefilled 50
   │
   ├── exits 0 → PR passes the tier-1 gate
   └── exits non-zero → PR blocked on tier-1 regression
   │
   ▼
Run artifact uploaded as a build artifact
   │
   ▼
Reviewer pulls the artifact locally, opens dashboard, scores
   │
   ▼
ScoredRun committed back to runs/ (or stored in artifact bucket)
```

The tier-1 CI gate runs on every PR. Tier 2 / Tier 3 / golden-truth scoring happens out-of-band, on a reviewer's schedule. This separation is deliberate — auto-failing a PR because an LLM-judge had a bad day is how teams end up distrusting their own evals.

## Future architecture changes (planned)

- **v0.4** introduces a `ReviewerAgreement` type for inter-rater reliability. `StepScore.reviewer_id` remains single-valued; agreement is computed across N scored-run files for the same suite.
- **v0.5** introduces `RunLineage` and `TrainingProposal` types. The proposal flow is gated on human approval at the schema level (discriminated union on `approved`).
- **v1.0** locks the schema-v1 contract permanently. Schema-v2 will require an explicit migration path.

See [`docs/ROADMAP.md`](./ROADMAP.md) for the version-by-version acceptance criteria.

## Related docs

- [`docs/BRIEF.md`](./BRIEF.md) — the philosophical basis
- [`docs/SCHEMA.md`](./SCHEMA.md) — the data contract, narrative form
- [`docs/COMPATIBILITY.md`](./COMPATIBILITY.md) — semver + schema-version policy
- [`docs/GOVERNANCE.md`](./GOVERNANCE.md) — how decisions get made
- [`docs/THREAT_MODEL.md`](./THREAT_MODEL.md) — security boundaries
- [`docs/INTEGRATIONS.md`](./INTEGRATIONS.md) — bridges to other eval frameworks
