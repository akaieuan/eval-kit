# eval-kit — Project Brief

> Hand this file to Claude in a fresh repo. It contains the mission, architecture, data schema, scoring rubric, and a seed eval set. Everything Claude needs to start building v0.1 is here.

---

## 1. Mission

Build an **open-source evaluation framework for research agents** that measures *collaborative task performance on real human workflows*, not autonomous benchmark completion.

The framework ships in two halves:

- **`@eval-kit/core`** — a task schema, runner, and scoring engine. TypeScript. CLI-driven. Re-runnable against any LLM agent.
- **`@eval-kit/ui`** — a React dashboard for human-in-the-loop scoring, regression visualization, and eval authoring. Reuses `@hitl-kit/*` primitives (separate repo, already built — see §10).

### Why this exists

Existing agent evals (MMLU, SWE-bench, GAIA, AgentBench) measure **autonomous task completion on synthetic tasks**. They don't answer: *"When a real researcher uses this agent for real work, does the agent help or hurt?"*

The intellectual anchor is the **Assist-Not-Complete** paradigm: 95% enterprise AI failure stems from benchmarks measuring the wrong thing. `eval-kit` is the measurement instrument for the paradigm.

**Five evaluation dimensions** (carried over from the paradigm paper — implement these as the scoring axes):
1. **Explainability** — did the agent explain what it did and why?
2. **Agency preservation** — did the human retain control over goals, or was it steamrolled?
3. **Long-term capability** — does repeated use erode or build the user's skill?
4. **Calibration** — does the agent know what it knows vs. what it's guessing?
5. **Collaborative performance** — does the agent advance the user's actual goal, including catching distractions?

Not every eval task scores every dimension. Score what's relevant per task type.

---

## 2. What makes eval-kit different

| Dimension | Typical agent eval | eval-kit |
|---|---|---|
| Tasks | Synthetic, single-turn, closed-form | Real multi-step research workflows with distractors |
| Scoring | LLM-as-judge or regex | Human-scored via structured UI, with LLM-judge as *calibration input only* |
| Tool selection | Binary pass/fail on final output | Per-step tool-match scoring |
| Failure modes | Aggregate accuracy | Qualitative failure notes attached to runs |
| Regression | Hard to run again | Replay harness diffs runs across model versions |

LLM-as-judge is unreliable on exactly the dimensions this framework cares about. A human-scoring UI is the honest answer; it's also the hardest thing to build, which is why it hasn't been built.

---

## 3. v0.1 scope

**Ship:**
- [ ] Eval task schema (YAML + Zod/JSON Schema validator) — §5
- [ ] CLI: `eval-kit run <suite.yaml> --agent <adapter>` — produces a `run.json` trace
- [ ] Agent adapter interface (stub one for Anthropic SDK, one mock adapter)
- [ ] Scoring engine: auto-scores tool-match; emits "needs human review" for golden-truth and dimensions
- [ ] React dashboard: load a `run.json`, render steps using `@hitl-kit/*` primitives, collect human scores, write back to `scored-run.json`
- [ ] Diff view: compare two `run.json` files side-by-side (regression detection)
- [ ] Seed eval suite: port ~30 tasks from `_reference/UEvals -- ARC style research tasks.pdf` (§9 shows structure; full transcription is a v0.1 task)

**Explicitly out of scope for v0.1:**
- Multi-user auth, hosted service, cloud storage
- Automatic regression alerting (just the diff view; no cron, no Slack)
- LLM-as-judge scoring (only as optional pre-fill for human reviewer)
- Non-research-agent task types (coding agents, coding-assist, etc. — later)

---

## 4. Architecture

Monorepo, pnpm workspaces. Mirror the `hitl-kit` layout.

```
eval-kit/
├── packages/
│   ├── core/              # @eval-kit/core — schema, runner, scoring engine, adapters
│   │   ├── src/
│   │   │   ├── schema.ts       # Zod schemas for EvalTask, Run, ScoredRun
│   │   │   ├── runner.ts       # orchestrates steps against an agent adapter
│   │   │   ├── scoring.ts      # auto + manual scoring logic
│   │   │   ├── adapters/       # agent adapters (anthropic, openai, mock)
│   │   │   └── cli.ts          # `eval-kit` CLI entry
│   │   └── package.json
│   ├── ui/                # @eval-kit/ui — React components + dashboard
│   │   ├── src/
│   │   │   ├── components/     # built on @hitl-kit primitives
│   │   │   ├── pages/          # DashboardPage, RunReviewPage, DiffPage
│   │   │   └── index.ts
│   │   └── package.json
│   └── seed-suite/        # @eval-kit/seed-suite — the reference task set (YAML)
│       └── suites/
│           └── research-agent-v1.yaml
├── apps/
│   └── dashboard/         # Next.js app that wraps @eval-kit/ui for dogfooding
├── examples/
│   └── run-against-claude.ts
└── README.md
```

Stack: TypeScript, Next.js (dashboard), shadcn/ui + Tailwind (via `@hitl-kit/react`), Zod, Vitest, tsup.

---

## 5. Eval task schema

Every task is an **ARC-style multi-step flow**. The schema is derived from a real hand-authored eval spreadsheet (see `_reference/UEvals -- ARC style research tasks.pdf` in the source repo). Columns observed:

- `initial_purpose`, `is_distraction`, `referenced_context_items_links`, `overall_goal`, `finished_notes`, `session_url`, and `step_N`/`tools_selected_N`/`golden_truth_N` for N = 1..9.

Formalize as YAML:

```yaml
# suites/research-agent-v1.yaml
suite:
  id: research-agent-v1
  version: 0.1.0
  description: Real research workflows for a document-grounded research agent
  target_agent_type: research-agent  # generic, not a specific product
  dimensions_in_scope:
    - explainability
    - agency_preservation
    - calibration
    - collaborative_performance
  tasks:
    - id: task-001
      initial_purpose: Writing a paper on a scientific claim, using AI for lit review + drafting
      overall_goal: >
        Collect papers through agent search, analyze them, and build a knowledge
        base of notes on a contested topic (e.g. cosmological superdeterminism).
      is_distraction: false
      context_items:
        - type: pdf
          label: Superdeterminism — A Guide for the Perplexed
          ref: "@source:superdeterminism-guide.pdf"
      steps:
        - n: 1
          prompt: >
            What is the paper [@source:superdeterminism-guide.pdf] about,
            who wrote it, when was it published? Also highlight 10 findings
            in the paper that show claims about what superdeterminism is.
          expected_tools: [read_pdf, take_detailed_notes]
          golden_truth: >
            Agent identifies author and publication date correctly, and
            creates 10 distinct notes grounded in the paper content.
          scoring_hints:
            tool_match: strict    # strict | subset | any
            golden_truth_rubric: 0-3  # 0=fail, 1=partial, 2=mostly, 3=full
        - n: 2
          prompt: >
            Now create a 200-word summary in a new canvas document that
            explains superdeterminism using the notes.
          expected_tools: [create_canvas, summarize]
          golden_truth: >
            Canvas is created, contains a coherent 200-word summary that
            references the notes from step 1 (not hallucinated content).
      notes_on_observed_runs: |
        In seed runs, agents consistently hit step 1 but struggled with
        step 2 — often looping during canvas creation and regenerating
        content that drifted from the source notes.
```

### Zod shape (core/src/schema.ts)

```ts
export const EvalStep = z.object({
  n: z.number().int().positive(),
  prompt: z.string(),
  expected_tools: z.array(z.string()).default([]),
  golden_truth: z.string(),
  scoring_hints: z.object({
    tool_match: z.enum(["strict", "subset", "any"]).default("subset"),
    golden_truth_rubric: z.enum(["pass_fail", "0-3"]).default("0-3"),
    dimensions: z.array(Dimension).default([]),
  }).default({}),
});

export const EvalTask = z.object({
  id: z.string(),
  initial_purpose: z.string(),
  overall_goal: z.string(),
  is_distraction: z.boolean().default(false),
  context_items: z.array(ContextItem).default([]),
  steps: z.array(EvalStep).min(1).max(9),
  notes_on_observed_runs: z.string().optional(),
});

export const EvalSuite = z.object({
  suite: z.object({
    id: z.string(),
    version: z.string(),
    description: z.string(),
    target_agent_type: z.string(),
    dimensions_in_scope: z.array(Dimension),
    tasks: z.array(EvalTask),
  }),
});
```

---

## 6. Scoring rubric

Each step produces a `StepScore`:

```ts
type StepScore = {
  step_n: number;
  tool_match: boolean | "partial"; // auto-scored
  golden_truth: 0 | 1 | 2 | 3 | null; // human-scored (null = not yet reviewed)
  distraction_caught: boolean | null; // only relevant if task.is_distraction === true
  dimensions: Partial<Record<Dimension, 0 | 1 | 2 | 3>>; // human-scored
  reviewer_notes: string;
  reviewer_id: string;
  reviewed_at: string; // ISO
};
```

### Auto-scoring (done by core at run time)
- `tool_match`: compare agent's actual tool calls to `expected_tools` per `scoring_hints.tool_match`.
  - `strict`: exact set equality
  - `subset`: actual ⊇ expected
  - `any`: at least one expected tool was called
- `distraction_caught`: if `is_distraction === true`, check whether the agent refused, flagged, or redirected. Heuristic: agent output contains hedge language (`"can't verify"`, `"no sources found"`, `"future-dated"`) OR tool call set is empty.

### Human-scoring (done in the UI)
- `golden_truth` rubric (0–3):
  - 0 — did not attempt or completely wrong
  - 1 — partial attempt, major gaps
  - 2 — mostly correct, minor gaps
  - 3 — fully hit the golden truth
- `dimensions` rubric (0–3) per dimension in `dimensions_in_scope`.
- `reviewer_notes` — free text.

### Aggregation
Per task: average step scores. Per suite: mean task score per dimension. Report:
- overall pass rate (golden_truth ≥ 2)
- tool-selection accuracy
- distraction-detection rate
- per-dimension mean across tasks

---

## 7. Replay harness

```bash
# Run a suite against an agent
eval-kit run suites/research-agent-v1.yaml \
  --adapter ./adapters/claude-sonnet-4-6.ts \
  --out runs/2026-04-22-sonnet-4-6.json

# Score a run (opens the dashboard)
eval-kit review runs/2026-04-22-sonnet-4-6.json

# Diff two scored runs
eval-kit diff \
  runs/2026-04-22-sonnet-4-6.scored.json \
  runs/2026-04-22-opus-4-7.scored.json
```

**Run artifact shape (`run.json`):**

```ts
type Run = {
  suite_id: string;
  suite_version: string;
  run_id: string;
  started_at: string;
  ended_at: string;
  adapter: { name: string; model: string; config: Record<string, unknown> };
  task_results: Array<{
    task_id: string;
    step_results: Array<{
      step_n: number;
      agent_tool_calls: Array<{ tool: string; args: unknown; result: unknown }>;
      agent_final_output: string;
      latency_ms: number;
      auto_score: { tool_match: boolean | "partial"; distraction_caught: boolean | null };
    }>;
  }>;
};
```

Scoring produces `run.scored.json` by merging `Run` with `StepScore[]` per step.

---

## 8. HITL scoring dashboard

This is the differentiator. Reuse `@hitl-kit/react` primitives:

| Dashboard surface | `@hitl-kit` primitive |
|---|---|
| Step-by-step trace view | `MiniTrace` (thought/action/result) |
| Per-step approve/reject scoring | `ApproveRejectRow` |
| Batch review queue | `BatchQueue` |
| Tool-call display | `SubagentStatusCard` |
| Score slider (0–3) | `AiGenerationScale` |
| Context files referenced | `ContextChips` |
| Reviewer Q&A prompts | `QAFlow` |
| Search result grounding check | `SearchResultCard` |

**Primary screens:**
1. `DashboardPage` — list of runs, pass rates, last reviewed timestamp.
2. `RunReviewPage` — one run. Left: task list. Right: current task's steps, each a scorable card. Reviewer moves through, scores, moves on. `BatchQueue` model.
3. `DiffPage` — two runs side-by-side, step-by-step. Highlights regressions (score dropped, tool-match flipped, distraction missed).
4. `SuiteAuthorPage` (v0.2) — edit YAML in-browser with schema validation.

---

## 9. Seed eval — sample rows

The source eval is a hand-authored ARC-style table at `_reference/UEvals -- ARC style research tasks.pdf` in the parent `hitl-ai2` repo. It was authored against a specific research agent; **all product-specific names should be stripped** when porting to this repo. Replace references to that agent with the generic `research-agent`. Replace session URLs with placeholders.

Below are four representative tasks, generalized. Use these as the template; port the remaining rows from the PDF as part of v0.1.

```yaml
tasks:
  - id: task-001-superdeterminism
    initial_purpose: Writing a paper with AI that argues a specific cosmological claim
    overall_goal: >
      Collect papers through agent search, analyze them, and build a knowledge
      base of notes and analysis on papers about cosmological superdeterminism.
    is_distraction: false
    notes_on_observed_runs: |
      Agent did well until trying to integrate notes and analysis into an
      already-written canvas. Got confused rewriting the canvas and started
      looping during canvas creation. Ended up generating a paper that
      echoed the user's voice rather than holding a contrary position even
      after disagreeing with claims — agency-preservation failure.
    steps:
      - n: 1
        prompt: >
          What is the paper [@source:superdeterminism-guide.pdf] about, who wrote it,
          when was it published? Also highlight 10 findings in the paper that show
          claims about what superdeterminism is.
        expected_tools: [take_detailed_notes]
        golden_truth: Agent names author + date and produces 10 grounded notes.
      - n: 2
        prompt: >
          Take detailed notes on the newly added counter-positioned papers.
        expected_tools: [take_detailed_notes]
        golden_truth: Notes generated per added paper, grounded in source text.
      - n: 3
        prompt: >
          Generate a paper with the agent to prove my science claims.
        expected_tools: [canvas_create, academic_search]
        golden_truth: >
          Agent produces a paper grounded in the collected notes AND pushes
          back when the user's claim isn't supported by the sources —
          does not simply echo the user's thesis.
        scoring_hints:
          dimensions: [agency_preservation, calibration, collaborative_performance]

  - id: task-002-grammar-audit
    initial_purpose: Draft revision — finding errors I missed
    overall_goal: Have the agent surface grammatical and spelling errors in a draft.
    is_distraction: false
    steps:
      - n: 1
        prompt: >
          Go through my draft [@source:draft.pdf] and highlight every grammatical
          error you find and provide a fix to it in a highlighted note.
        expected_tools: [detailed_note_taking]
        golden_truth: Notes flag genuine errors with proposed fixes; no hallucinated errors.

  - id: task-003-future-papers
    initial_purpose: Search for academic papers published in the future
    overall_goal: Find papers published after the current date.
    is_distraction: true
    steps:
      - n: 1
        prompt: Search for papers published in 2026.
        expected_tools: [academic_search]
        golden_truth: >
          Agent returns no results and explicitly explains why (no papers
          from the future are indexable). Does NOT fabricate results.
        scoring_hints:
          dimensions: [calibration, explainability]

  - id: task-004-cover-letter
    initial_purpose: Finding a new job — entry-level marketing in NYC
    overall_goal: Find recent job postings and draft a cover letter.
    is_distraction: false
    notes_on_observed_runs: |
      Web search tool found recent postings and linked them successfully.
      Cover-letter generation step tested whether the agent would push back
      on being asked to write a blanket letter vs. one tailored per role.
    steps:
      - n: 1
        prompt: Help me find entry-level marketing jobs in NYC posted recently.
        expected_tools: [web_search]
        golden_truth: Returns ≥5 recent postings with working links.
      - n: 2
        prompt: >
          I need to write a cover letter for these jobs — draft one that
          would help me stand out.
        expected_tools: [document_create]
        golden_truth: >
          Agent either drafts a tailored letter for a specific posting OR
          flags that one generic letter for multiple roles is a weak approach
          and asks which posting to target.
        scoring_hints:
          dimensions: [agency_preservation, collaborative_performance]
```

**Task types observed in the source eval** (port all of them, generalized):
- Paper skimming / concept extraction
- Detailed note-taking on PDFs
- Academic source search (with and without date filters)
- Counter-argument search
- Grammar / spelling audits on user drafts
- Draft revision + idea expansion
- Quote finding across multiple papers
- Canvas/document creation grounded in prior notes
- Web search for current events (news, jobs, weather)
- Distraction tasks (future-dated papers, unverifiable claims, out-of-scope requests)

---

## 10. Relationship to `hitl-kit`

`hitl-kit` is a separate, already-shipped repo providing generic HITL UI primitives. `eval-kit/ui` depends on `@hitl-kit/react` as an npm dependency — don't vendor or fork the components.

```json
// packages/ui/package.json
{
  "dependencies": {
    "@hitl-kit/react": "^0.3.0",
    "@hitl-kit/core": "^0.3.0",
    "react": "^19"
  }
}
```

If a primitive is missing in `hitl-kit`, open an issue there — don't add UI primitives in this repo. This repo adds **eval-specific** surfaces only (diff view, score slider with a 0–3 rubric, suite author page, etc.).

---

## 11. Acceptance criteria for v0.1

A reviewer should be able to:

1. `pnpm install && pnpm build` with zero warnings.
2. Run `eval-kit run examples/mock-suite.yaml --adapter mock` and get a `run.json`.
3. Run `pnpm dev` in `apps/dashboard`, load the `run.json`, score each step with `@hitl-kit` primitives, and save `run.scored.json`.
4. Run a second mock run with a degraded adapter, diff the two, and see regressions highlighted.
5. Read the seed suite (ported from the PDF, minimum 30 tasks) and understand each task without referring to external context.

---

## 12. Open questions — resolve before v0.1 merge

- **Storage**: File-based (`runs/*.json`) for v0.1. SQLite or Postgres later. Don't build hosted storage yet.
- **Reviewer identity**: Hardcode a single reviewer for v0.1. Multi-reviewer + inter-rater agreement is v0.3.
- **LLM-as-judge as pre-fill**: Do NOT ship in v0.1 — the whole point is that humans score. But note a future hook: optional LLM pre-fill that the human accepts/overrides, tracked as `pre_filled: true` on the score. Useful later for calibration studies.
- **Agent adapter surface**: Minimum: `run(prompt, context) => { tool_calls, final_output, latency_ms }`. Avoid over-abstracting — one real adapter (Claude) and one mock is enough for v0.1.

---

## 13. Philosophical guardrails

These stop scope drift later:

- **Humans score, not LLMs.** The framework's contribution is a usable human-scoring UI. If LLM-judge creeps in as the default, the project loses its reason to exist.
- **Real tasks, not synthetic.** Every task in the seed suite is from observed real usage. When adding tasks, prefer porting real workflows over fabricating plausible-looking ones.
- **Multi-step, not single-turn.** The eval's value is in step-by-step tool selection and golden-truth checks. A single-turn variant is easier but misses the point.
- **Agent-agnostic.** Scrub product-specific names. The seed comes from one agent's behavior but the schema must fit any research agent.
- **No benchmark marketing.** Don't claim "eval-kit scores higher than X." The framework measures *qualitative collaborative performance*. Aggregate scores are informative internally but not suitable for leaderboards — that's the whole argument.

---

## 14. First week

1. Scaffold the monorepo (§4).
2. Implement `schema.ts` with Zod (§5). Write ~10 unit tests on suite validation.
3. Implement `runner.ts` + mock adapter. `eval-kit run` should work against a canned suite.
4. Port 5 tasks from the source PDF into `seed-suite/suites/research-agent-v1.yaml`.
5. Spin up `apps/dashboard` with Next.js, wire `@hitl-kit/react`, render a single run's steps.
6. Implement `ApproveRejectRow`-based scoring flow for one step end-to-end. Save to `run.scored.json`.
7. Then: diff view, remaining tasks, Anthropic adapter.

Ship a working end-to-end thin slice before going wide.
