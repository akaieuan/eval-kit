# Roadmap

Public roadmap for eval-kit. Phases are versioned; each phase has concrete acceptance criteria and cannot ship until all of them are met.

The [philosophical guardrails in BRIEF §13](./BRIEF.md#13-philosophical-guardrails) survive every phase. If a proposed feature crosses them, the right answer is "not in this project" — not "we'll loosen the guardrail."

---

## Status table

| Version | Theme | Status |
|---|---|---|
| v0.1.0 | Core schema, runner, scoring, seed suite | ✅ Shipped 2026-04-22 |
| v0.3.0-alpha.0 | Scoring cockpit, tiered automation, YAML agents | ✅ Shipped 2026-04-23 |
| v0.3.0 (stable) | Hygiene, polish, npm publish | 🚧 In progress |
| v0.4.0 | Reviewer maturation + standalone dashboard | 📋 Planned |
| v0.5.0 | Continuous-learning flywheel | 📋 Planned — [RFC 0001](./rfcs/0001-continuous-learning.md) accepted, ready to implement |
| v1.0.0 | API stability commitment | 🔮 Gated on external usage |

---

## v0.3.0 — stable

**Theme:** Promote the alpha to a stable release without adding features. Polish and publish.

**Acceptance criteria**

- [x] GitHub hygiene: issue/PR templates, CODEOWNERS, Dependabot, SECURITY.md
- [ ] `@eval-kit` npm org created; `@eval-kit/core` + `@eval-kit/ui` published under the `alpha` dist-tag
- [ ] `CHANGELOG.md [0.3.0]` promoted from alpha; release notes finalized
- [ ] Git tag `v0.3.0` pushed; GitHub release created with release notes
- [ ] README badges: CI status, npm version, license
- [ ] `docs/ROADMAP.md` + RFC process in place (this doc)
- [ ] Five consecutive main-branch CI runs green across all four matrix jobs (ubuntu/macos × Node 20/22)
- [ ] README `60-second quickstart` tested end-to-end on a clean machine (no `npm install` surprises)

**Out of scope (defer to v0.4):** standalone `npx` dashboard, multi-reviewer support, any new schema types.

---

## v0.4.0 — reviewer maturation + standalone dashboard

**Theme:** Make the reviewer experience load-bearing, and decouple the dashboard from cloning the repo.

**Motivation:** v0.3 was single-reviewer and required `git clone` for the dashboard. Real use demands (a) multiple reviewers so inter-rater agreement is measurable, and (b) `npx @eval-kit/dashboard <runs-dir>` so a reviewer doesn't need the monorepo checked out to score runs.

**Acceptance criteria**

- [ ] `npx @eval-kit/dashboard <runs-dir>` boots the dashboard against an arbitrary runs directory — closes the promise at [README.md:39](../README.md#L39)
- [ ] `@eval-kit/dashboard` package published to npm with a bin entry
- [ ] Multi-reviewer schema: new top-level `ReviewerAgreement` type (keeps `StepScore` backward-compatible — see RFC in `docs/rfcs/` for exact shape)
- [ ] `eval-kit agreement <runA> <runB> --metric cohens-kappa` CLI — computes Cohen's κ for two reviewers scoring the same suite
- [ ] Dashboard `/agreement` route visualizes step-by-step disagreements
- [ ] Reviewer identity stops being hardcoded — `settings` page lets a reviewer set their own id; this id lands in `StepScore.reviewer_id`
- [ ] Closes [BRIEF §12 open question](./BRIEF.md#12-open-questionsresolve-before-v01-merge) on "Multi-reviewer + inter-rater agreement" (originally slated for v0.3, slipped)
- [ ] Docs: new `/docs/multi-reviewer` page explaining when to run parallel review vs single-reviewer

**Out of scope (defer to v0.5):** any training, any run lineage, any agent-to-agent work. v0.4 is strictly about humans reviewing better.

---

## v0.5.0 — continuous-learning flywheel

**Theme:** Close the loop from scored runs to improved agents, with humans as the gate — never replaced.

**RFC status:** [RFC 0001 — continuous learning](./rfcs/0001-continuous-learning.md) accepted 2026-04-23. Implementation unblocked.

**Acceptance criteria**

- [x] RFC 0001 accepted
- [ ] New zod-first schema types in [packages/core/src/schema.ts](../packages/core/src/schema.ts): `RunLineage`, `TrainingProposal`, with matching `parseX` helpers
- [ ] `AgentProfile` gains a `version` field so lineage can reference specific agent builds
- [ ] CLI commands (commander pattern matches existing [cli.ts](../packages/core/src/cli.ts)):
  - `eval-kit propose <teacher-run> <student-run>` — creates a `TrainingProposal`
  - `eval-kit lineage <run>` — walks `parent_run_id` chain, prints the training history
  - `eval-kit train <proposals.json>` — emits training JSONL from **approved only** proposals
- [ ] Dashboard `/proposals` route with explicit approve/reject flow; `approved: true` required on a `TrainingProposal` before `eval-kit train` will include it
- [ ] Aggregation guard in [scoring.ts](../packages/core/src/scoring.ts): no code path can produce training output from unapproved proposals — enforced at the type level (discriminated union on `approved`)
- [ ] BRIEF §13 is updated to name agent-to-agent training loops as in-scope *provided* the human-approval gate is enforced

**Philosophical guardrail recap:** humans gate the *loop*, not every step. A v0.5 training proposal is analogous to a pull request: an AI (or another agent) can open it, a human must accept it, and rejected proposals are logged for audit.

**Out of scope:** automated training infrastructure (no GPU orchestration, no hosted fine-tuning). eval-kit produces the JSONL; the user brings the trainer.

---

## v1.0.0 — stability commitment

**Theme:** Lock down a public API surface. Take eval-kit from "interesting internal tool" to "depend on it in production."

**Acceptance criteria**

- [ ] All [BRIEF §11 acceptance criteria](./BRIEF.md#11-acceptance-criteria-for-v01) satisfied (originally scoped for v0.1 but extended through v0.5)
- [ ] Semver + breaking-change policy documented in [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] Public API surface listed explicitly — everything else is internal and may change in minor releases
- [ ] At least 3 unaffiliated users running eval-kit on real workflows, OR README updated to state "single-maintainer tool, not recommended for production reliance"
- [ ] All top-level zod schemas have 100% parse-roundtrip test coverage
- [ ] v0.4/v0.5 surfaces (standalone dashboard, proposals flow) have stabilized — no breaking schema changes in the last two minor releases

---

## How this roadmap gets updated

- Roadmap changes happen via PR. A roadmap-only PR does not require tests but does require an issue or discussion explaining the motivation.
- Scope movement between phases (e.g., "this v0.4 item is bigger than we thought, moving to v0.5") requires a checkbox to be re-scoped in the acceptance criteria above — never silently dropped.
- New phases (v0.6+) are not speculated here until v0.5 ships. This roadmap is a plan, not a wishlist.

## Related

- [docs/BRIEF.md](./BRIEF.md) — authoritative project brief, schema, guardrails
- [docs/rfcs/](./rfcs/) — design docs for non-trivial architectural changes
- [CHANGELOG.md](../CHANGELOG.md) — what already shipped
