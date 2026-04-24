# @eval-kit/seed-suite

Reference eval tasks for research, coding, and support agents — multi-step YAML suites with real distractors. Used by [eval-kit](https://github.com/akaieuan/eval-kit) — the scoring cockpit for research agents.

[![npm version](https://img.shields.io/npm/v/@eval-kit/seed-suite)](https://www.npmjs.com/package/@eval-kit/seed-suite)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/akaieuan/eval-kit/blob/main/LICENSE)

## Install

```bash
npm install @eval-kit/seed-suite
# or
pnpm add @eval-kit/seed-suite
```

## What's in the box

Three suites, each multi-step with real-world distractors:

- **`suites/research-agent-v1.yaml`** — document-grounded research workflows. Tasks include cosmological-claim writing, grammar-audit revisions, future-dated paper searches (the distraction), cover-letter drafting, direct-quote finding, and current-events lookups. Tests whether the agent grounds claims, refuses to fabricate, and catches unverifiable requests.
- **`suites/coding-agent-v1.yaml`** — code-assistance workflows. Architecture preservation, hallucinated APIs, test writing, diff explanation, bug diagnosis, blanket-refactor pushback. Tests whether the agent reads existing code before suggesting changes and resists making sweeping rewrites without justification.
- **`suites/support-agent-v1.yaml`** — customer-support workflows. Ambiguous refund triage, security escalation, de-escalation, policy-gap calibration, multi-issue triage. Tests whether the agent knows when to escalate, when to apologize, and when to refuse.

Every task has a `golden_truth` per step (what success looks like) and `scoring_hints.dimensions` (which of the five rubric dimensions apply). Every suite includes at least one **distraction task** — a request that should be refused or flagged, not satisfied.

## Use the suites

After installing, the YAML files are at `node_modules/@eval-kit/seed-suite/suites/`. Run them via [@eval-kit/core](https://www.npmjs.com/package/@eval-kit/core):

```bash
# from a project that has both packages installed:
npx eval-kit run node_modules/@eval-kit/seed-suite/suites/research-agent-v1.yaml \
  --adapter anthropic --model claude-sonnet-4-5
```

Or copy a suite into your own `suites/` directory and customize:

```bash
cp node_modules/@eval-kit/seed-suite/suites/research-agent-v1.yaml suites/my-research.yaml
# edit suites/my-research.yaml to add your own tasks
npx eval-kit run suites/my-research.yaml --adapter anthropic
```

## Programmatic access

```js
import { suitePath } from "@eval-kit/seed-suite";

console.log(suitePath("research-agent-v1"));
// → /abs/path/to/node_modules/@eval-kit/seed-suite/suites/research-agent-v1.yaml
```

## Why ported, not synthetic

Every task in the seed suite is from observed real usage — actual research workflows, actual coding sessions, actual support tickets. Fabricated "plausible-looking" tasks don't make the cut. The point of eval-kit is to measure agent behavior on the work people actually do, not on benchmark fixtures the agent might have memorized.

When adding tasks: prefer porting real workflows over inventing them. See the [project brief §10](https://github.com/akaieuan/eval-kit/blob/main/docs/BRIEF.md) for the contribution guidelines.

## Status

**v0.1.0** — three reference suites covering research, coding, and support agents. Stable; new task domains land as new files (e.g. `suites/legal-agent-v1.yaml`) without versioning the existing suites.

## Links

- [Project README](https://github.com/akaieuan/eval-kit#readme)
- [Project brief](https://github.com/akaieuan/eval-kit/blob/main/docs/BRIEF.md)
- [Browse suites on GitHub](https://github.com/akaieuan/eval-kit/tree/main/packages/seed-suite/suites)
- [Issues](https://github.com/akaieuan/eval-kit/issues)

## License

MIT
