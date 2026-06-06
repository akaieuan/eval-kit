# eval-kit trace + scoring protocol

This directory is the **language-agnostic contract** for eval-kit. Every artifact eval-kit produces — `run.json`, `run.scored.json`, suite YAMLs, individual `StepScore`s — conforms to a JSON Schema in this tree.

These files are the source of truth for the protocol. The TypeScript implementation in [`packages/core/src/schema.ts`](../packages/core/src/schema.ts) is the **reference implementation** of the protocol; the JSON Schemas published here are the contract any implementation must satisfy.

That distinction is load-bearing: a Python runner producing a conformant `run.json` should drop into the eval-kit dashboard with zero TypeScript involvement.

## Versioning

```
schemas/
├── v1/                      ← current
│   ├── eval-suite.schema.json
│   ├── run.schema.json
│   ├── scored-run.schema.json
│   ├── step-score.schema.json
│   └── dimension.schema.json
└── README.md (this file)
```

The schema version is **independent of the package version**. `@eval-kit/core@0.3.1` and `@eval-kit/core@0.4.0` both produce `schema_version: "1.0.0"` artifacts. A schema-v1 → schema-v2 transition is a separate release with a migration path documented in [`docs/COMPATIBILITY.md`](../docs/COMPATIBILITY.md).

Every run artifact carries a top-level `schema_version` field starting at v1. Older artifacts (pre-v1, produced by 0.3.x before this directory landed) are accepted as `schema_version: undefined` and treated as v1 by the reference implementation. v2 will introduce a hard validation requirement.

## What the schemas describe

| File | Describes | Produced by |
|---|---|---|
| `dimension.schema.json` | The fixed `Dimension` enum (5 scoring dimensions) | Suite YAML, every StepScore |
| `eval-suite.schema.json` | The full YAML suite shape — tasks, steps, scoring hints | Human-authored suite YAMLs |
| `run.schema.json` | A trace artifact — auto-scored, not yet human-reviewed | `eval-kit run` |
| `scored-run.schema.json` | A trace + human review | `eval-kit review` save, dashboard autosave |
| `step-score.schema.json` | A single per-step human verdict (subset of scored-run) | Inline scoring, dashboard autosave |

## Validating against the schema (any language)

```bash
# Python (ajv-cli, jsonschema, etc.)
python -c "import json, jsonschema; jsonschema.validate(json.load(open('runs/demo.json')), json.load(open('schemas/v1/run.schema.json')))"

# Node (ajv)
npx -y ajv-cli validate -s schemas/v1/run.schema.json -d runs/demo.json

# Go (santhosh-tekuri/jsonschema)
jv schemas/v1/run.schema.json runs/demo.json
```

A Python or Go runner producing eval-kit-compatible artifacts is a first-class consumer of the protocol — the TypeScript reference implementation is one of several allowed producers, not a gate.

## Regeneration

The JSON Schemas are committed to the repo so reviewers can inspect the contract without running the build. They are regenerated from the Zod source via [`scripts/export-schemas.mjs`](../scripts/export-schemas.mjs) and verified in CI against the committed copies — drift fails the build.

To regenerate locally:

```bash
pnpm --filter @eval-kit/core build
node scripts/export-schemas.mjs
git diff schemas/   # should be empty if Zod is unchanged
```

## Stability commitment

- **schema-v1 fields are stable** across the 0.3 → 0.4 → 0.5 release line. New optional fields may be added; existing fields cannot be removed or change semantics.
- **Breaking the schema requires a schema-version bump and a migration.** See [docs/COMPATIBILITY.md](../docs/COMPATIBILITY.md) for the policy.
- **The TypeScript implementation may evolve faster than the schema.** A new `@eval-kit/core` minor release that does not bump `schema_version` is guaranteed to read and write artifacts in the same schema.

## Related

- [`docs/SCHEMA.md`](../docs/SCHEMA.md) — narrative spec of the protocol, field-by-field
- [`docs/COMPATIBILITY.md`](../docs/COMPATIBILITY.md) — semver + schema-version policy
- [`packages/core/src/schema.ts`](../packages/core/src/schema.ts) — Zod reference implementation
