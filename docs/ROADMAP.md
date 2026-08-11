# Roadmap

Public roadmap for eval-kit. Phases are versioned; each phase has concrete acceptance criteria and cannot ship until all of them are met.

The [philosophical guardrails in BRIEF §13](./BRIEF.md#13-philosophical-guardrails) survive every phase. If a proposed feature crosses them, the right answer is "not in this project" — not "we'll loosen the guardrail."

---

## Status table

| Version | Theme | Status |
|---|---|---|
| v0.1.0 | Core schema, runner, scoring, seed suite | ✅ Shipped 2026-04-22 |
| v0.3.0-alpha.0 | Scoring cockpit, tiered automation, YAML agents | ✅ Shipped 2026-04-23 |
| v0.3.0 (stable) | Hygiene, polish, npm publish | ✅ Shipped 2026-04-23 |
| v0.4.0 | **Gates** — mandated/discretionary schema + scoring, gate tools, verification layer | ✅ Shipped 2026-08-06 |
| v0.5.0 | Reviewer calibration + standalone dashboard *(was v0.4.0 — renumbered when gates landed first)* | 📋 Next |
| v0.6.0 | Stratified audit — subgroup sampling, "not assessed" reporting, rare-event confidence intervals | 📋 Planned |
| v0.7.0 | Continuous-learning flywheel *(was v0.5.0)* | 📋 [RFC 0001](./rfcs/0001-continuous-learning.md) accepted |
| v1.0.0 | API stability commitment | 🔮 Gated on external usage |

**Why the renumbering:** the gate work (research № 005, "the gate is the unit of measurement") landed as v0.4.0 in August 2026, displacing the phases planned below by one. The reviewer-calibration phase must precede the flywheel: a training loop running on uncalibrated scores would launder reviewer noise into training data. Stratified audit slots between them because the authorization settings the framework now targets (moderation, support, public-sector decisions) concentrate their errors in subgroups that uniform sampling essentially never surfaces.

---

---

## v0.3.0 — stable

**Theme:** Promote the alpha to a stable release without adding features. Polish and publish.

**Acceptance criteria**

- [x] GitHub hygiene: issue/PR templates, CODEOWNERS, Dependabot, SECURITY.md
- [x] `@eval-kit` npm org created; `@eval-kit/core` + `@eval-kit/ui` published under the `alpha` dist-tag
- [x] `CHANGELOG.md [0.3.0]` promoted from alpha; release notes finalized
- [x] Git tag `v0.3.0` pushed; GitHub release created with release notes
- [x] README badges: CI status, npm version, license
- [x] `docs/ROADMAP.md` + RFC process in place (this doc)
- [ ] Five consecutive main-branch CI runs green across all four matrix jobs (ubuntu/macos × Node 20/22)
- [ ] README `60-second quickstart` tested end-to-end on a clean machine (no `npm install` surprises)

**Out of scope (deferred, now v0.5):** standalone `npx` dashboard, multi-reviewer support, any new schema types.

---

## v0.4.0 — gates (shipped 2026-08-06)

**Theme:** the gate — the moment control returns to a human — becomes the unit of measurement.

**What shipped** (PRs [#35](https://github.com/akaieuan/eval-kit/pull/35), [#36](https://github.com/akaieuan/eval-kit/pull/36)):

- Schema: `MandatedGate` (`before_tools` per task), `Blocker` + `gate_response` per step, `GateEvent` with ordering capture, `MandatedGateScore` (required/honored/violated), `DiscretionaryScore` (blockers/asked/matched/unprompted)
- Gate tools injected into the agent toolbox: `request_approval`, `ask_user` (`GATE_TOOLBOX`)
- Scoring: `scoreMandatedGates` (binary, ordering-sensitive), `scoreDiscretionary` (precision/recall, never averaged with compliance), three separate aggregates on `SuiteAggregate`
- The conservative-failure rule: when gate ordering wasn't captured, `gateCallsFromEvents` assumes every mandated gate was violated — an instrument that cannot see must not report success
- Verification layer on `AutoScore` (`passed` count + typed `Finding`s), `distraction_acted`
- Golden-run harness (`pnpm verify:goldens`) exercising the gate path end to end

**Known gaps carried forward:** the dashboard renders none of this (RFC 0002), and the three reference suites declare no gates — extending them is part of the gate-visibility work, not a separate phase.

---

## v0.5.0 — reviewer calibration + standalone dashboard

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

**Out of scope (defer to v0.7):** any training, any run lineage, any agent-to-agent work. v0.5 is strictly about humans reviewing better.

---

## v0.6.0 — stratified audit

**Theme:** measurement that survives rare, unevenly distributed errors.

**Motivation:** in the authorization settings the framework targets (moderation, support, public-sector decisions), the residual error rate is small and its distribution is not uniform — errors concentrate in subgroups (a dialect, a claim type, a document format). At a 1% error rate, 100 error cases means reviewing ~10,000 decisions; uniform sampling both blows the review budget and still misses concentrated failure. Two consequences the schema must carry: sample *at the gate*, where escalated cases are already enriched for error, and report **"this stratum was not assessed"** as a first-class outcome — an aggregate that silently omits a stratum is the failure mode research № 007 documents.

**Acceptance criteria** (to be refined in an RFC before implementation)

- [ ] Stratum declaration on suites/tasks (consumer-defined keys, e.g. language, content type, claim category)
- [ ] Per-stratum aggregates in `aggregateScoredRun`, with explicit `not_assessed` strata in the output — never silently dropped
- [ ] Gate-enriched sampling helper: given a review budget, prioritize escalated/violated/disagreement cases over uniform draws
- [ ] Rare-event confidence intervals on compliance and recall aggregates (small-n honesty in the report output)
- [ ] `eval-kit report` renders the stratified table with absent strata named

**Out of scope:** demographic inference. Strata are declared by the suite author, never guessed from content.

---

## v0.7.0 — continuous-learning flywheel

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

**Philosophical guardrail recap:** humans gate the *loop*, not every step. A v0.7 training proposal is analogous to a pull request: an AI (or another agent) can open it, a human must accept it, and rejected proposals are logged for audit.

**Out of scope:** automated training infrastructure (no GPU orchestration, no hosted fine-tuning). eval-kit produces the JSONL; the user brings the trainer.

---

## v1.0.0 — stability commitment

**Theme:** Lock down a public API surface. Take eval-kit from "interesting internal tool" to "depend on it in production."

**Acceptance criteria**

- [ ] All [BRIEF §11 acceptance criteria](./BRIEF.md#11-acceptance-criteria-for-v01) satisfied (originally scoped for v0.1 but extended through v0.7)
- [ ] Semver + breaking-change policy documented in [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] Public API surface listed explicitly — everything else is internal and may change in minor releases
- [ ] At least 3 unaffiliated users running eval-kit on real workflows, OR README updated to state "single-maintainer tool, not recommended for production reliance"
- [ ] All top-level zod schemas have 100% parse-roundtrip test coverage
- [ ] v0.5/v0.7 surfaces (standalone dashboard, proposals flow) have stabilized — no breaking schema changes in the last two minor releases

---

## How this roadmap gets updated

- Roadmap changes happen via PR. A roadmap-only PR does not require tests but does require an issue or discussion explaining the motivation.
- Scope movement between phases (e.g., "this v0.5 item is bigger than we thought, moving to v0.6") requires a checkbox to be re-scoped in the acceptance criteria above — never silently dropped.
- New phases beyond v0.7 are not speculated here until v0.5 ships. This roadmap is a plan, not a wishlist.

## Related

- [docs/BRIEF.md](./BRIEF.md) — authoritative project brief, schema, guardrails
- [docs/rfcs/](./rfcs/) — design docs for non-trivial architectural changes
- [CHANGELOG.md](../CHANGELOG.md) — what already shipped
