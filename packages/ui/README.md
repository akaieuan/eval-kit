# @eval-kit/ui

React components for scoring, reviewing, and diffing eval runs. Tailwind + Radix. Built for [eval-kit](https://github.com/akaieuan/eval-kit) — the scoring cockpit for research agents.

[![npm version](https://img.shields.io/npm/v/@eval-kit/ui)](https://www.npmjs.com/package/@eval-kit/ui)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/akaieuan/eval-kit/blob/main/LICENSE)

## Install

```bash
npm install @eval-kit/ui @eval-kit/core
# or
pnpm add @eval-kit/ui @eval-kit/core
```

Peer deps: `react ^18 || ^19`, `react-dom ^18 || ^19`. Bring your own Tailwind setup.

## What's in the box

- **Page-level surfaces** — `DashboardPage`, `RunReviewPage`, `DiffPage`. Drop-in views composed from the primitives below.
- **Scoring primitives** — `ScoreSlider`, `StepReviewCard`, `DimensionExplainer`, `AutosaveBadge`. The 0–3 rubric UI.
- **Inbox** — `InboxView`, `InboxRow`. Prioritized queue with keyboard-first scoring (`1`/`2`/`3`, `j`/`k`, `a`, `s`, `Enter`).
- **Diff view** — `DiffRow`, `RegressionSummary`, `ToolCallDelta`. Two-run side-by-side comparison.
- **Shell** — `AppShell`, `SidebarNav`, `CommandPalette`, `ThemeToggle`, `SessionTracker`. The dashboard chrome.
- **Design primitives** — `Button`, `Card`, `Dialog`, `Popover`, `Tabs`, `Tooltip`, `Pill`, `Badge`, `StatCard`, `Sparkline`, `Kbd`, `EmptyState`, `InlineHelp`, `ProgressRing`, `Select`, `Input`, `Textarea`. All Tailwind + Radix-based, themed via CSS variables.

## Usage

Import the styles once at your app root:

```ts
import "@eval-kit/ui/styles.css";
```

Then use components directly:

```tsx
import { RunReviewPage } from "@eval-kit/ui";
import type { ScoredRun, EvalSuite } from "@eval-kit/core";

export default function ReviewRoute({ run, suite }: { run: ScoredRun; suite: EvalSuite }) {
  return (
    <RunReviewPage
      run={run}
      suite={suite}
      onSave={async (updated) => { /* server action */ }}
    />
  );
}
```

The dashboard at [apps/dashboard](https://github.com/akaieuan/eval-kit/tree/main/apps/dashboard) in the main repo is a complete reference — every component has a real usage you can copy.

## Tailwind setup

The primitives use a token system (`bg-surface`, `text-fg`, `border-edge`, etc.) defined in `src/styles/tokens.css`. Either:

1. Import `@eval-kit/ui/styles.css` (recommended — gets you the tokens and base styles)
2. Or copy `src/styles/tokens.css` and customize for your brand

Tailwind config: ensure `content` includes `node_modules/@eval-kit/ui/dist/**/*.{js,mjs}`.

## Status

**v0.3.0** — API stable for the 0.3.x line. Component surfaces may grow in v0.4 (multi-reviewer, agreement view) and v0.5 (training proposals).

## Links

- [Project README](https://github.com/akaieuan/eval-kit#readme)
- [Project brief](https://github.com/akaieuan/eval-kit/blob/main/docs/BRIEF.md)
- [Roadmap](https://github.com/akaieuan/eval-kit/blob/main/docs/ROADMAP.md)
- [Dashboard reference app](https://github.com/akaieuan/eval-kit/tree/main/apps/dashboard)
- [Issues](https://github.com/akaieuan/eval-kit/issues)

## License

MIT
