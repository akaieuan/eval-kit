# RFC 0001 — Continuous-learning flywheel

- **Status:** Accepted
- **Target:** v0.5.0
- **Author:** @akaieuan
- **Created:** 2026-04-23
- **Accepted:** 2026-04-23

## Summary

Add a human-gated flywheel that turns scored eval runs into training signal for the agent-under-test. Introduce run lineage and `TrainingProposal` as first-class schema types, CLI commands (`propose`, `lineage`, `train`), and a dashboard `/proposals` route. Training output is only produced from proposals that a human has marked `approved: true`.

This is deliberately **not** LLM-as-judge. Humans remain the source of truth for scoring. What this adds is a *loop*: an AI (or another agent) can propose improvements; a human must accept them before they count.

## Motivation

Today the eval ends at the scored run. A reviewer looks at a bad step, writes a note, and that's it. The insight stays in reviewer notes or in someone's head; it doesn't compound into agent improvement.

Real-world agent teams run a cycle:

1. Agent v1 runs the suite. Human scores it.
2. Bad steps get turned into training examples (SFT targets, DPO pairs).
3. Agent v2 is fine-tuned from that signal.
4. Agent v2 runs the suite again. Compare to v1.

The `eval-kit export` command (v0.3) already emits SFT/DPO JSONL. But it's one-shot — no lineage, no record of "agent v2 came from v1 via these approved proposals." Without lineage, you can't audit drift, you can't explain regressions, and you can't enforce the human-gate discipline ("did a human actually approve these training rows?").

## Detailed design

### Schema additions (zod-first, matching existing `parseX` pattern in [packages/core/src/schema.ts](../../packages/core/src/schema.ts))

```ts
export const RunLineage = z.object({
  run_id: z.string(),
  parent_run_id: z.string().nullable(),
  training_source: z.enum(["none", "human_eval", "agent_proposal"]).default("none"),
  derived_via_proposal_ids: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
});
export type RunLineage = z.infer<typeof RunLineage>;
export function parseRunLineage(input: unknown): RunLineage { return RunLineage.parse(input); }

export const TrainingProposal = z.object({
  id: z.string(),
  teacher_run_id: z.string(),
  student_run_id: z.string(),
  proposed_by: z.enum(["human", "agent"]),
  proposed_by_id: z.string(),
  rationale: z.string(),
  approved: z.boolean().nullable().default(null),  // null = pending
  approved_by: z.string().nullable().default(null),
  approved_at: z.string().datetime().nullable().default(null),
  created_at: z.string().datetime(),
});
export type TrainingProposal = z.infer<typeof TrainingProposal>;
export function parseTrainingProposal(input: unknown): TrainingProposal { return TrainingProposal.parse(input); }
```

`AgentProfile` gets a new optional `version: string` field so lineage entries can point at specific agent builds.

### Storage

- `runs/<id>.lineage.json` — one per run; sibling to existing `.json` and `.scored.json`
- `proposals/<id>.json` — **one file per proposal**, top-level `proposals/` directory (added to `.gitignore` by default)
- Rejected proposals are retained indefinitely under `proposals/<id>.json` with `approved: false` — audit log, not a queue

Follows the existing file-based storage model (per BRIEF §12 — "Don't build hosted storage yet").

**Schema design constraint:** the `TrainingProposal` shape must compose well into training datasets when many proposals are concatenated (predictable nesting, stable key order, no free-form prose where structured data fits). This keeps the format compressible and lets future agent-to-agent training pipelines fold many proposals into a single training payload without expensive schema-normalization passes.

### CLI (commander pattern — matches existing [cli.ts](../../packages/core/src/cli.ts))

```
eval-kit propose <teacher-run-path> <student-run-path> [--rationale <text>] [--by agent|human]
eval-kit lineage <run-id>
eval-kit train <proposals.json> [--out train.jsonl] [--format sft|dpo]
```

`train` is a **hard gate**: it filters proposals to `approved === true` and fails loudly if given any non-approved proposals without an explicit `--include-pending` flag that prints a large warning and requires a confirmation.

### Dashboard

New route `/proposals`:

- List all `TrainingProposal`s, grouped by `approved: null | true | false`
- Each proposal card shows: teacher run summary, student run summary, rationale, proposer
- Approve / Reject buttons write the decision back to `proposals/<id>.json` with `approved_by` and `approved_at`
- Rejected proposals stay visible (auditable) but are excluded from `train` output

### Aggregation guard

The `aggregateScoredRun` function in [packages/core/src/scoring.ts](../../packages/core/src/scoring.ts) gains a sibling, `aggregateApprovedProposals`, that takes a list of `TrainingProposal` and filters to `approved === true` before doing anything. The type-level guarantee is a discriminated union:

```ts
type ApprovedProposal = TrainingProposal & { approved: true };
```

All training-emission code paths accept `ApprovedProposal[]`, not `TrainingProposal[]` — the type system prevents passing unapproved data downstream.

## Guardrail check

Explicit statement per [BRIEF §13](../BRIEF.md#13-philosophical-guardrails):

- **"Humans score, not LLMs."** Respected. This RFC does not change scoring. Humans still score every step. What changes is that humans also gate an additional artifact (proposals) that feeds training.
- **"Real tasks, not synthetic."** Unaffected — proposals reference existing runs on existing suites.
- **"Multi-step, not single-turn."** Unaffected.
- **"Agent-agnostic."** Unaffected — proposals are agent-independent artifacts.
- **"No benchmark marketing."** Unaffected.

BRIEF §13 will be amended in this PR to add: *"Humans gate every artifact that feeds training. Agent-generated proposals are permitted; agent-only approval is not."*

If this guardrail is ever removed (e.g., "let's auto-approve proposals above a confidence threshold"), the project has drifted and should be forked rather than have its spec changed.

## Alternatives considered

- **Skip lineage; extend `export` in place.** Rejected — export is already doing one thing well. Adding proposal-awareness to export would muddle the CLI surface and hide the human-gate from anyone reading `export`'s docs.
- **Put proposals inside `ScoredRun` as a nested field.** Rejected — proposals are across-run artifacts. Keeping them separate matches their lifecycle (scored run is immutable once saved; a proposal's `approved` flag flips later).
- **Make approval automatic when tier-1 auto-score improves.** Rejected outright — this is the guardrail violation. No automatic approval, ever, without explicit config the user has to set and BRIEF has to permit.
- **Use existing `pre_filled` flag for proposal approval.** Rejected — `pre_filled` is about LLM-drafted scores a human accepted. Proposals are a different lifecycle artifact with different auditability needs. Merging them would overload the flag.

## Resolved decisions

(Originally "Open questions" — resolved 2026-04-23 before acceptance.)

1. **Proposal storage format** → **one file per proposal** at `proposals/<id>.json`. Matches the existing `.json`/`.scored.json` pattern; easy to diff, easy to track in git history if a team chooses to commit them. Schema is designed to compose/fold cleanly when many proposals are batched into training payloads (see "Storage" section above).

2. **Rejected proposal retention** → **kept indefinitely**. Cost is trivial (a few KB of JSON per proposal); value as an audit trail is high — explains why an agent version DIDN'T get certain training examples. Purging is the kind of decision that should require explicit deletion, not silent expiry.

3. **CI integration** → **warn on staleness, not on count**. `eval-kit ci` surfaces a non-blocking warning if **any pending proposal is older than 7 days** (default; tunable via `--max-pending-age <duration>`). Pure count is a bad signal — a productive scoring session can legitimately produce many fresh proposals. Staleness is the actual sign of neglect. A `--strict-proposals` flag flips the warning into a non-zero exit so teams can opt into hard enforcement.

4. **Multi-reviewer interaction** → **single human approval is sufficient**. A proposal must be approved by a human before it feeds training, but it does NOT require κ-agreement between two reviewers. Multi-reviewer concurrence is a recommended team practice, not a schema-enforced precondition. The dashboard `/proposals` page MAY surface "no second reviewer" as soft signal next to a proposal, but the approval gate stays single-human. Quoting the maintainer's resolution: *"review before approval, if review needed it is human (end of line)."*

## Implementation sequence

Unblocked as of 2026-04-23 (RFC accepted). Implementation order:

1. Schema additions + parse helpers + tests (in [packages/core/src/schema.ts](../../packages/core/src/schema.ts))
2. `AgentProfile.version` field + tests
3. CLI commands one at a time: `propose` → `lineage` → `train`
4. Aggregation guard + scoring.ts additions
5. CI integration: `eval-kit ci` staleness warning (`--max-pending-age 7d` default, `--strict-proposals` flag)
6. Dashboard `/proposals` route (server component + approve/reject server action)
7. BRIEF §13 amendment PR
8. CHANGELOG entry for v0.5.0

## Links

- [Roadmap](../ROADMAP.md#v050--continuous-learning-flywheel)
- [BRIEF §13 — Philosophical guardrails](../BRIEF.md#13-philosophical-guardrails)
- [packages/core/src/schema.ts](../../packages/core/src/schema.ts)
- [packages/core/src/cli.ts](../../packages/core/src/cli.ts)
- [packages/core/src/scoring.ts](../../packages/core/src/scoring.ts)
