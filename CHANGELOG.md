# Changelog

All notable changes to eval-kit are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] — 2026-04-23

First stable minor of the v0.3 line. **API stable** — minor releases (0.3.x) will not break public surfaces. Patches go to existing functionality only; new features land in 0.4 and beyond per [docs/ROADMAP.md](docs/ROADMAP.md).

This release promotes the `0.3.0-alpha.0` and `0.3.0-alpha.1` work to stable. No new feature work since `0.3.0-alpha.1` — see those entries below for the substance of the v0.3 release.

### Changed
- `@eval-kit/core` and `@eval-kit/ui` published under `latest` dist-tag for the first time. The `alpha` dist-tag now tracks pre-release work for v0.4 and beyond.
- `@eval-kit/seed-suite` remains at `0.1.0` — no changes since first publish, no version inflation.

### Internal
- Release workflow ([.github/workflows/release.yml](.github/workflows/release.yml)) now skips publishing packages whose current version already exists on npm. Lets a release tag bump only a subset of packages without failing the workflow. Workflow uses `pnpm pack` + `npm publish <tarball>` to combine pnpm's workspace-deps resolution with npm's OIDC token exchange for Trusted Publishing.
- **Trusted Publishing partially configured** — workflow is wired for OIDC + provenance attestations, but the v0.3.0 publish itself fell back to a one-time granular token because of org-level publish-permission asymmetry across packages. Per-package trusted publisher config will be re-verified before v0.4.0 ships.

## [0.3.0-alpha.1] — 2026-04-23

Patch for `@eval-kit/core` only. `@eval-kit/ui` and `@eval-kit/seed-suite` are unchanged.

### Fixed
- **`eval-kit init` produced unusable projects.** The scaffolded `package.json` pinned `@eval-kit/core` to `^0.2.0`, a version that was never published — `npm install` failed with `ETARGET`. `init` now injects the running core version at scaffold time, and the fallback template tracks the current alpha.

## [0.3.0-alpha.0] — 2026-04-23

First public alpha. The scoring cockpit is functional end-to-end: YAML-defined
suites and agents, tiered automation (auto-scoring → LLM pre-fill → active
triage), real Anthropic adapter with tool-use + prompt caching, and a
Linear-style dashboard for human review. APIs may break in 0.3.x patches.

### Added
- **Agent profiles** — YAML-defined agents. Zero TypeScript. Drop a file under `agents/` with backend/model/system prompt/tools and run it:
  ```bash
  eval-kit run suites/my-suite.yaml --agent agents/claude-research-v1.yaml
  ```
  New `@eval-kit/core/agents` subpath exports `AgentProfile`, `parseAgentProfile`, `adapterFromProfile`, `loadAgentProfile`, `listAgentProfilesIn`. Two seed profiles shipped: `agents/claude-research-v1.yaml`, `agents/claude-coding-v1.yaml`. Dashboard `/agents` list + `/agents/[id]` detail + `/agents/new` form with backend picker (anthropic | mock | http) and validated YAML editing.
- **Custom adapter path loading** — `--adapter ./path.js` dynamically imports an adapter file (default export or named `adapter`). Escape hatch for non-YAML-expressible agents.
- **Tier 3 active triage** — new `pre_fill_confidence` field on `StepScore` (populated by `prefillStepScore`). Inbox priority now weights low-confidence drafts higher and flags pre-fill/auto-score disagreements (high pre-fill score + auto-score says tools missed = human attention). Signals appear inline on each row.
- **Reviewer Inbox** — `/inbox` route with prioritized queue of steps needing attention. Inline keyboard scoring (`1`/`2`/`3` for golden truth, `a` accept AI draft, `s` skip, `j`/`k` navigate, `enter` open full review). Preview appears on the home page above the run table.
- **Inline scoring server action** — `scoreStepInline()` writes human scores without leaving the inbox. Upgrades unscored runs to scored on first edit.
- **Home page rework** — surfaces the Inbox preview first; Overview stat cards + Runs table below.
- **Domain expansion** — two new seed suites:
  - `suites/coding-agent-v1.yaml` — architecture preservation, hallucinated APIs, test writing, diff explanation, bug diagnosis, blanket-refactor pushback.
  - `suites/support-agent-v1.yaml` — ambiguous refund, security escalation, de-escalation, policy-gap calibration, multi-issue triage.
- **Adapter cookbook** — two new built-in adapters:
  - `createOpenAIAdapter` — function-calling loop; consumer brings the OpenAI SDK.
  - `createHttpAdapter` — generic POST-to-URL adapter for any agent behind an HTTP endpoint; supports custom request/response transformers.
- **`/runs` filter + search** — adapter filter, status filter (scored/unscored), full-text search on run id / suite / model.
- **Tiered automation (v0.3 preview)** — three production-pipeline hooks:
  - **Tier 2: LLM pre-fill** — optional "Pre-fill task" button on the review page uses Claude to draft scores (golden_truth + dimensions + distraction + rationale). Drafts are clearly marked `AI draft` via the `pre_filled: true` flag; any human edit flips the flag. Humans remain the source of truth.
  - **`eval-kit ci`** — runs a suite against an adapter and gates on tier-1 (auto-scored) regressions. Supports `--baseline`, `--min-tool-match`, `--min-distraction-catch`, and `--max-prefilled` threshold flags. Non-zero exit on violation. Drop-in for GitHub Actions.
  - **`eval-kit export`** — converts scored runs to training-ready JSONL in three shapes: `sft` (per-step records with labels), `dpo` (chosen/rejected pairs across two runs), `raw` (full fidelity dump). Optionally stitch with `--suite` for real step prompts.
- **Blue accent + dark/light themes** — replaced the olive palette with a neutral-zinc base + blue accent. Theme toggle in the top bar persists via localStorage; pre-hydration init script prevents theme flash.
- **Linear-style dashboard** — app shell with sidebar nav, command palette (`cmd+k`), global keyboard shortcuts (`g h/r/s/a/d`, `?` for help).
- **Dark-green-brown (moss) palette** — warm earth-tone Tailwind-based design system, replacing ~570 lines of handwritten CSS.
- **Inline teaching surfaces** — `InlineHelp` strips, `DimensionExplainer` popovers, `WelcomePanel`, empty states that teach.
- **`/docs` route** — in-app MDX documentation: quickstart, authoring, adapters, CLI, scoring rubric, paradigm, FAQ.
- **AI-assisted task authoring** — paste a real agent-user transcript, Claude drafts a YAML `EvalTask`, human edits in Monaco with live Zod schema diagnostics. First-class feature.
- **Real Anthropic adapter** — `@anthropic-ai/sdk`-backed adapter with tool-use loop, prompt caching on the system + tool block, `maxToolIterations` guard.
- **`eval-kit init`** — scaffolds a starter repo for new users (`suites/`, `adapters/`, `runs/`).
- **`eval-kit preflight`** — dry-runs a single task to sanity-check an adapter.
- **OSS hygiene** — LICENSE, CONTRIBUTING, CHANGELOG, GitHub Actions CI (Node 20 + 22).
- **Autosave** on the scoring flow — per-step debounced server action, `AutosaveBadge` indicator.

### Changed
- `packages/ui` primitives rebuilt on Tailwind + Radix + `class-variance-authority`.
- `apps/dashboard/src/app/globals.css` reduced from 572 lines to ~20 lines of overrides + `@tailwind base/components/utilities`.

## [0.1.0] — 2026-04-22

### Added
- **`@eval-kit/core`** — Zod schema for `EvalSuite`, `EvalTask`, `EvalStep`, `Run`, `ScoredRun`. Runner orchestrates steps against an `AgentAdapter`. Auto-scoring for tool-match and distraction heuristic. Diff engine. YAML/JSON loader. CLI with `run`, `review`, `diff`, `report`. 22 passing tests.
- **`@eval-kit/ui`** — Initial React components: `ScoreSlider`, `StepReviewCard`, `RunReviewPage`, `DashboardPage`, `DiffPage`.
- **`@eval-kit/seed-suite`** — 6 reference research-agent tasks in YAML.
- **`apps/dashboard`** — Next.js 15 dashboard with home, run review, and diff routes.
- **Mock adapter** (pristine + degraded) for end-to-end testing.
