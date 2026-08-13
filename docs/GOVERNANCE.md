# Governance

This document describes how decisions get made in eval-kit. It is short on purpose — eval-kit is a small, opinionated project, not a large open-source community.

## Project shape

eval-kit is maintained by a single primary maintainer ([@akaieuan](https://github.com/akaieuan)). It is not a community-governed project in the Apache or CNCF sense. Decisions are made by the maintainer, with the philosophical guardrails in [`docs/BRIEF.md §13`](./BRIEF.md) as the explicit constraint.

This shape is deliberate. The framework's value is its small, sharp scope. A larger governance structure would create pressure to expand scope to justify the structure — which is the failure mode the project is designed against.

## Categories of change

Different changes go through different decision paths.

### Category 1 — Bug fixes, doc fixes, internal refactors

**Path:** open a PR. Maintainer reviews and merges, or sends back with feedback.

No issue or RFC required. CI must pass (`pnpm typecheck && pnpm test && pnpm build`). Add a CHANGELOG entry if user-visible.

### Category 2 — New features within the existing scope

**Path:** open an issue first describing the proposal. Maintainer responds with "go ahead" or "let's discuss." Then PR.

"Existing scope" means: another adapter, another seed suite task, another CLI flag, a new dashboard surface that fits the nine-surface map, performance improvements, accessibility work.

The issue-first step is so we don't reject a finished PR that doesn't fit. Both sides save time.

### Category 3 — Schema changes, breaking changes, architectural changes

**Path:** RFC required. See "RFC process" below.

This includes:

- Anything that changes [`schemas/v1/`](../schemas/) (artifact shape, field semantics).
- Anything that changes the [`AgentAdapter`](../packages/core/src/adapters/types.ts) interface.
- Anything that changes the tier separation (Tier 1 / Tier 2 / Tier 3).
- A new top-level package or app.
- A change to the supported Node range, package manager, or build tooling.
- Anything the maintainer reads and isn't sure how to bucket — default to RFC.

### Category 4 — Philosophy / guardrail changes

**Path:** RFC required *and* a written justification that engages [BRIEF §13](./BRIEF.md) directly.

The guardrails ([`docs/BRIEF.md §13`](./BRIEF.md), [`README.md` §13](../README.md)) prevent scope drift. They are the project's reason for existence. Changing them is allowed in principle but treated as the highest-friction decision the project supports.

Historical example: the v0.5 continuous-learning flywheel ([RFC 0001](./rfcs/0001-continuous-learning.md)) required updating §13 to clarify that agent-to-agent training proposals are in-scope *provided* the human-approval gate is enforced. That clarification took an RFC and a documented update.

## RFC process

RFCs live in [`docs/rfcs/`](./rfcs/). One file per RFC, numbered.

### Lifecycle

```
   draft ──▶ proposed ──▶ accepted ──▶ implemented
                  │
                  └──▶ rejected (kept in tree as documentation)
```

A draft is a PR to `docs/rfcs/NNNN-short-title.md` where the file starts with `Status: Draft`. Drafts can be iterated on freely.

When the author thinks the RFC is ready for a decision, they move it to `Status: Proposed` and request review.

The maintainer responds with `Status: Accepted` (merged, implementation can start) or `Status: Rejected` (merged anyway, kept as a record of "we considered this and decided no").

`Status: Implemented` is set when the corresponding code ships.

### RFC template

```markdown
# RFC NNNN — <title>

Status: Draft | Proposed | Accepted | Rejected | Implemented
Author: @<github-handle>
Created: YYYY-MM-DD
Target version: vX.Y.Z (or "unscheduled")

## Summary

One paragraph.

## Motivation

What problem does this solve? What's blocked without it? Who's asking?

## Detailed design

The thing. Schemas, interfaces, file paths, behavior changes.

## How does this interact with §13 (philosophical guardrails)?

Explicit answer required for category-3 and category-4 RFCs. May be "n/a — this is implementation-level only."

## Alternatives considered

What else was on the table? Why was this picked?

## Unresolved questions

The things the author is unsure about.

## Future work

What this RFC enables but does NOT do.
```

Existing RFCs:

- [RFC 0001 — continuous learning](./rfcs/0001-continuous-learning.md) — accepted 2026-04-23, target v0.5

## Decisions that do NOT need an RFC

- Anything in Category 1 or 2.
- Renaming an internal symbol that isn't part of the public API surface.
- Performance optimization that preserves observable behavior.
- Test additions.
- CI workflow tweaks (within reason — replacing the whole CI provider would be an RFC).
- Adding a new adapter that conforms to the existing `AgentAdapter` interface.
- Adding new tasks to an existing seed suite, as long as they meet the "real, not synthetic" guardrail.

## Voting / consensus

There is no voting. The maintainer decides. RFC discussion in the PR is the input; the merge decision is the output.

If a contributor disagrees with a decision, the right move is to fork. The MIT license makes this explicit and supported. We will not gatekeep a fork — but we also will not promise to maintain a path back if the fork diverges.

## How to get something maintained outside of the core scope

Some categories of contribution are valuable but don't belong in `@eval-kit/*`:

- **A new agent SDK adapter** (Gemini, Mistral, local model): publish as `eval-kit-adapter-<name>` in your own namespace. Document in [`docs/INTEGRATIONS.md`](./INTEGRATIONS.md).
- **A bridge to another eval framework** (Inspect, OpenAI evals, LangSmith): same — `eval-kit-bridge-<name>`. Examples ship in [`examples/`](../examples/).
- **A hosted variant** of the dashboard: fork. The framework is intentionally local-first; hosted is out of scope for v0.x. A fork that maintains schema compatibility benefits from upstream schema stability.

## How decisions are revisited

Decisions can be revisited via a new RFC that explicitly references the prior decision. The prior RFC is updated to `Status: Superseded` and the new one carries the active design.

There is no "we'll re-look at this in 6 months" cadence. Decisions are durable until something concrete (new use case, new constraint, new evidence) prompts a revisit.

## How succession works

If the primary maintainer becomes unavailable, the project enters maintenance mode. The npm packages remain pinned at the last published version. The repo remains MIT-licensed; forking and continuing development is the supported path.

If multiple unaffiliated users are running eval-kit in production by the time a succession is needed, the maintainer will work with them on a handoff. This commitment is documented in the v1.0 acceptance criteria ([`docs/ROADMAP.md`](./ROADMAP.md)).

## Related docs

- [`docs/BRIEF.md`](./BRIEF.md) — the philosophical guardrails
- [`docs/ROADMAP.md`](./ROADMAP.md) — what's planned per version
- [`docs/rfcs/`](./rfcs/) — accepted and rejected design proposals
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — how to actually open a PR
- [`docs/COMPATIBILITY.md`](./COMPATIBILITY.md) — what counts as a breaking change
