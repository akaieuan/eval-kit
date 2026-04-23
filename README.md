# eval-kit

**The scoring cockpit for research agents. Humans score, not LLMs. Real tasks, not synthetic. Multi-step, not single-turn.**

<!-- Drop a PNG of the /inbox page at docs/images/inbox.png to surface the scoring loop. -->
![Reviewer Inbox](docs/images/inbox.png)

---

## Why

Existing agent evals (MMLU, SWE-bench, GAIA, AgentBench) measure **autonomous task completion on synthetic tasks**. They don't answer the question that actually matters:

> When a real person uses this agent for real work, does it help or hurt?

The claim behind eval-kit: 95% of AI-agent failure in the wild is a measurement failure. Scores go up while users quietly abandon the product. eval-kit measures five dimensions that LLM-judges structurally can't:

1. **Explainability** — did the agent explain what it did and why?
2. **Agency preservation** — did the human retain control over goals?
3. **Long-term capability** — does repeated use build or erode the user's own skill?
4. **Calibration** — does the agent know what it knows vs. what it's guessing?
5. **Collaborative performance** — did it advance the real goal, including catching distractions?

LLMs can't score these on an agent trained with the same objectives — they share the blind spots. A human reviewer catches what the judge rationalizes.

---

## 60-second quickstart

```bash
# 1. Scaffold a new eval project
npx @eval-kit/core@alpha init my-evals
cd my-evals && npm install

# 2. Run the starter suite against the mock adapter
npx eval-kit run suites/starter.yaml --adapter mock

# 3. Score the run — clone the eval-kit repo for the dashboard
#    (standalone npx dashboard lands in v0.4)
git clone https://github.com/akaieuan/eval-kit && cd eval-kit
pnpm install && pnpm --filter @eval-kit/dashboard dev
# → open http://localhost:3000
```

Score each step with `1` / `2` / `3` for golden truth, `j`/`k` to move between steps, `⌘K` for the command palette.

---

## What's in the box

- **YAML-defined eval suites** — multi-step flows with golden truths, expected tools, scoring hints per dimension
- **YAML-defined agent profiles** — describe your Claude agent (model, system prompt, tools) in YAML; no TypeScript required
- **Tier-1 auto-scoring** — tool-match check, distraction heuristic (deterministic, cheap, always on)
- **Tier-2 LLM pre-fill** — optional, confidence-tracked drafts that humans accept or override
- **Tier-3 active triage** — prioritizes the ambiguous cases so human attention goes where it matters
- **Local dashboard** — Inbox, run review with keyboard-first scoring, diff view, in-app docs
- **CLI** — `run`, `review`, `diff`, `report`, `init`, `preflight`, `ci`, `export`

---

## Use it in your project

```bash
npx @eval-kit/core@alpha init my-evals
cd my-evals && npm install
```

The scaffolder gives you:

```
my-evals/
├── suites/starter.yaml       # your eval tasks
├── adapters/my-agent.ts      # wrap your agent
├── runs/                     # run artifacts land here
├── package.json
└── README.md
```

### Define an agent by YAML — zero code

`agents/claude-research-v1.yaml`:

```yaml
agent:
  id: claude-research-v1
  name: Claude research agent v1
  based_on: anthropic
  model: claude-sonnet-4-5
  system_prompt: |
    You are a research assistant. Use tools when they help.
    Flag uncertainty. Never fabricate sources.
  tools:
    - name: academic_search
      description: Search academic papers
    - name: read_pdf
      description: Read a PDF by reference
```

Run it:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
eval-kit run suites/my-suite.yaml --agent agents/claude-research-v1.yaml
```

### Escape hatch — custom adapter file

When YAML isn't enough, point at any adapter module:

```bash
eval-kit run suites/my-suite.yaml --adapter ./adapters/my-agent.mjs
```

See [the adapter guide](http://localhost:3000/docs/adapters) in the in-app docs for the full interface.

---

## Assist-Not-Complete — the paradigm

eval-kit exists to measure a specific thing: **whether an AI agent actually helps a human at a task, as judged by the human.** That sounds obvious, but it's the one question existing eval frameworks structurally can't answer.

The philosophical guardrails live in [docs/BRIEF.md §13](docs/BRIEF.md#13-philosophical-guardrails). The short version:

- **Humans score, not LLMs.** LLM-judge is allowed as *optional pre-fill* (flagged `pre_filled: true`), never as default.
- **Real tasks, not synthetic.** The seed suite is ported from observed real usage. Fabricated "plausible-looking" tasks don't earn their place.
- **Multi-step, not single-turn.** The interesting failures live at the seams.
- **Agent-agnostic.** Ships with a Claude adapter, an OpenAI adapter, and a generic HTTP adapter.
- **No benchmark leaderboards.** Aggregate scores are internally useful, not publishable.

---

## CI integration

```bash
eval-kit ci suites/my-suite.yaml \
  --adapter anthropic --model claude-sonnet-4-5 \
  --baseline runs/baseline.scored.json \
  --min-tool-match 80 --max-prefilled 50
```

Exits non-zero on **tier-1** regressions (auto-scored). Golden-truth regressions are reported but never fail the build — those need human judgment.

---

## Export scored runs as training data

```bash
# SFT pairs for fine-tuning, high-quality only
eval-kit export runs/v4.2.scored.json \
  --suite suites/my-suite.yaml \
  --min-score 2 \
  --format sft --out training/sft.jsonl

# DPO preference pairs across two model versions
eval-kit export runs/v4.1.scored.json \
  --compared-with runs/v4.2.scored.json \
  --format dpo --out training/dpo.jsonl
```

Pre-filled scores are excluded by default (`--include-prefilled` to opt in).

---

## Status

**v0.3.0-alpha** — APIs may break. File-based, single-user. Designed for internal use inside research/safety teams, not as a hosted service.

- [CHANGELOG](CHANGELOG.md)
- [Project brief](docs/BRIEF.md) — mission, architecture, schema, seed-eval spec, philosophical guardrails
- [CONTRIBUTING](CONTRIBUTING.md)

Report bugs or request features: https://github.com/akaieuan/eval-kit/issues

---

## License

MIT — see [LICENSE](LICENSE)
