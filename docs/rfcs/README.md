# RFCs

Design docs for non-trivial changes to eval-kit. An RFC is required for anything that:

- Adds or changes a zod schema in [packages/core/src/schema.ts](../../packages/core/src/schema.ts)
- Adds a new CLI command or changes an existing command's contract
- Adds a new top-level route to the dashboard
- Touches one of the [§13 philosophical guardrails](../BRIEF.md#13-philosophical-guardrails) in any way

Small changes (bug fixes, refactors, dependency bumps, docs polish) don't need one. If unsure, open a GitHub Discussion first.

## Process

1. Copy a prior RFC as a template (or start from scratch with the sections below).
2. Number it sequentially: `NNNN-short-slug.md`.
3. Open a draft PR titled `rfc: <slug>`. Tag with the `rfc` label.
4. Discussion happens on the PR. The RFC is not merged until:
   - All §13 guardrail questions are resolved explicitly.
   - Open Questions section is empty or each question has a disposition.
   - A linked implementation issue exists (or the RFC itself is declared informational).
5. Merge when accepted. Rejection closes the PR with the rationale recorded in the PR description.

## Template sections

Every RFC has:

- **Summary** — one paragraph, plain English.
- **Motivation** — what workflow is blocked today, what we'd unblock.
- **Detailed design** — schema, code shapes, CLI surface, UI changes, migration story.
- **Guardrail check** — explicit statement on whether §13 is affected and how.
- **Alternatives considered** — what else we looked at and why we didn't pick it.
- **Open questions** — what we need to decide before implementing.

## Index

| # | Title | Status | Targets |
|---|---|---|---|
| [0001](./0001-continuous-learning.md) | Continuous-learning flywheel | Draft | v0.5.0 |
