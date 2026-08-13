# `schemas/` — the machine-readable protocol contract

These JSON Schema files are the contract a producer in **any language** validates against. A Python runner that emits a conformant `run.json` is a first-class eval-kit producer: the dashboard will score it and `eval-kit diff` will compare it.

For the narrative spec — what each field means and why — read [`docs/SCHEMA.md`](../docs/SCHEMA.md). This file covers layout and regeneration only.

## Layout

```
schemas/
└── v1/
    ├── eval-suite.schema.json   # EvalSuite  — authored YAML, input to `eval-kit run`
    ├── run.schema.json          # Run        — the trace a runner emits
    ├── step-score.schema.json   # StepScore  — one reviewer's judgement of one step
    └── scored-run.schema.json   # ScoredRun  — a Run with human StepScores attached
```

The directory is versioned by **schema major version**, not by package version. `schemas/v1/` holds every `1.x.y` revision of the contract; a breaking change creates `schemas/v2/` and both are served. The three version axes (schema, package, suite) are independent — see the policy table in [`docs/SCHEMA.md`](../docs/SCHEMA.md).

Only these four artifacts get their own file. `EvalTask`, `EvalStep`, `GateEvent` and the rest are inlined, because they are never exchanged on their own and a separate file would imply a stability promise the project doesn't make for them.

## These files are generated — do not edit them

The Zod schemas in [`packages/core/src/schema.ts`](../packages/core/src/schema.ts) are the single source of truth. These files are derived from them.

```bash
pnpm -r build && pnpm schemas:build
```

`pnpm schemas:check` is the CI gate. It regenerates, then fails if the result differs from what is committed, then validates every committed artifact against the published contract.

That second half matters as much as the first. The drift check only proves the JSON Schema agrees with Zod; it does not prove either agrees with the artifacts on disk. A contract that rejects the reference implementation's own output would be worse than no contract at all, so `schemas:check` validates all committed runs, scored runs and seed suites against the schema a third-party producer would use.

**A generated file that is committed but unverified becomes a second source of truth that lies.** `docs/SCHEMA.md` promises reviewers can read the contract without running the build, and that promise survives exactly until the first un-regenerated Zod edit. The gate is what keeps it true.

If `schemas:check` fails, do not regenerate blindly. Review the diff against the versioning policy — adding an optional field is a patch, adding a required field or renaming one is a major — then commit `schemas/` on purpose. Staging alone is not enough; the check reads `git status --porcelain`, where a staged file still counts as dirty.

## Known divergence from the reference implementation

**Unknown properties.** These schemas carry `additionalProperties: false`, so an artifact with an unrecognised field fails validation. The TypeScript reference implementation is more permissive: Zod's default `.strip()` mode **silently discards** unknown keys rather than rejecting them, so `parseRun` accepts such an artifact and drops the extra field.

The direction is safe — anything valid under these schemas is accepted by `parseRun` — but the reverse does not hold. Validate against these files if you want to know your producer is correct; `parseRun` will not tell you about a misspelled field, it will just lose it.

This is the exact mechanism that hid `schema_version` for as long as it did: the docs told producers to emit it, and `parseRun` quietly dropped it because the Zod schema had no such field.

## `schema_version`

Every `EvalSuite` and `Run` carries `schema_version` (`major.minor.patch`, validated).

It is **optional in v1** — artifacts recorded before the field existed parse as `1.0.0` — and will be **required in v2+**, where absence becomes a hard failure. It is deliberately independent of the `@eval-kit/*` package version and of `suite_version`.
