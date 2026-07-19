# Contributing to eval-kit

Thanks for your interest. eval-kit is a small OSS project; contributions that sharpen the core thesis — **humans score, not LLMs; real tasks, not synthetic; multi-step, not single-turn** — are especially welcome.

## Dev setup

```bash
git clone https://github.com/akaieuan/eval-kit.git
cd eval-kit
pnpm install
pnpm -r build
pnpm -r test
```

You need Node 20+ and pnpm 10+.

## Running locally

```bash
# Dashboard
pnpm --filter @eval-kit/dashboard dev
# → http://localhost:3000

# Generate a mock run to score
pnpm tsx examples/run-against-mock.ts
```

## Project layout

- `packages/core` — schema, runner, scoring, diff, CLI, adapters. TypeScript + Zod.
- `packages/ui` — React components and pages (Tailwind + Radix primitives).
- `packages/seed-suite` — reference YAML eval suites.
- `apps/dashboard` — Next.js 15 dashboard that dogfoods `@eval-kit/ui`.
- `examples/` — runnable snippets.

## Before you open a PR

```bash
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

All three should be clean. CI runs the same on Node 20 and 22.

## Credibility harness

Three checks simulate a stranger about to depend on the published packages — run them
before a release, and they run in CI as independent jobs:

```bash
pnpm smoke:publish   # pack the packages, install the tarballs in a scratch project OUTSIDE
                     # the repo, import every exports subpath, run the CLI, and run attw
pnpm check:readme    # typecheck the README examples that opt in (see below)
pnpm api:check       # regenerate api-surface/*.d.ts + snapshot runtime exports; fail on diff
```

All three assume `pnpm build` has run first.

### Documentation checks (README `check` convention)

A fenced code block is extracted and typechecked **only** when its info string is a TypeScript
language (`ts`, `tsx`, or `typescript`) **and** carries the explicit `check` token:

- <code>```ts check</code> / <code>```tsx check</code> → extracted and run through `tsc --noEmit`
  against the built `@eval-kit/*` types.
- <code>```ts</code> (no `check`), <code>```bash</code>, <code>```json</code>, <code>```yaml</code> → skipped.

Opt-in is explicit, never inferred. Annotate a block with `check` when it presents real API
surface a reader would copy; leave illustrative snippets (e.g. examples importing a fictional
SDK) unannotated. If `pnpm check:readme` fails, the example is wrong — fix the docs.

### API surface snapshots

`pnpm api:check` writes the normalized public `.d.ts` surface of each package to
`api-surface/<pkg>.d.ts` and fails if it differs from the committed snapshot. A diff is not a
freeze — it means the public API changed. Review it, and if intentional commit the regenerated
file in the same PR. It also snapshots the sorted runtime export names of each built entry.

## Scope of contributions we want

- **New task types** in the seed suite (real workflows only — see guardrail §13 in the README).
- **Adapters** for other agent SDKs (OpenAI, Gemini, local models).
- **UI primitives** that make the scoring flow faster or clearer.
- **Docs fixes**, especially concrete examples in the authoring guide.

## Scope we don't want (yet)

- LLM-as-judge as default scoring. It's allowed as *optional pre-fill* that a human accepts/overrides, tracked as `pre_filled: true`. As a default, it erodes the project's reason to exist.
- Synthetic benchmark tasks. The seed suite is porting real observed workflows; additions should be from real usage.
- Hosted/multi-tenant storage. v0.x stays file-based.

## Filing issues

Good issue titles: `diff view misses regression when tool_match flips from partial → false`. Bad: `diff broken`.

Include:
- eval-kit version (from `packages/core/package.json`)
- Node version
- A minimal reproduction (YAML + mock adapter is usually enough)

## Philosophical notes

See README §13 — the "philosophical guardrails" stop scope drift. If you're unsure whether a proposed change fits, read those first.

Questions? Open an issue with the `question` label.
