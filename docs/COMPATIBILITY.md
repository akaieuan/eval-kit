# Compatibility policy

This document is the **compatibility contract** for eval-kit consumers. It governs how the public API, the schema, and the runtime evolve across versions.

## The three independent version axes

eval-kit versions three things separately. Conflating them is the most common source of confusion.

| Axis | Example | Bump triggers |
|---|---|---|
| **Schema version** | `schema_version: "1.0.0"` in every artifact | Changes to the structure of `Run`, `ScoredRun`, `EvalSuite`, `StepScore`, or `Dimension` |
| **Package version** | `@eval-kit/core@0.3.1` | Changes to the TypeScript public API surface |
| **Suite version** | `suites/research-agent-v1.yaml:version: "0.1.0"` | Changes to suite content (tasks, golden truths) |

A new `@eval-kit/core` release can ship without bumping the schema (most do). A schema bump requires a coordinated migration (none have shipped yet — v1 is the only schema). Suite versions are author-controlled and are not coordinated with the package.

## Schema-version policy (`schema_version`)

| Change | Schema bump | Behavior |
|---|---|---|
| Add an optional field | patch (1.0.0 → 1.0.1) | Old consumers ignore the new field; producers may emit it. |
| Add a required field | major (1.0.0 → 2.0.0) | Old consumers fail validation; producers must emit it. |
| Add a value to a closed enum (e.g. `Dimension`) | major | Old aggregators would silently drop or mis-bucket the new value. |
| Rename a field | major | No silent renames — always a deprecation + new field + old field removal across two major bumps. |
| Change semantics of an existing field | major | Same as rename — semantic shifts are breaking. |
| Tighten a constraint (e.g. min-length) | major | Old artifacts may stop validating. |
| Loosen a constraint | patch | Old artifacts continue to validate. |
| Add a new top-level artifact shape (e.g. `ReviewerAgreement` in v0.4) | minor (1.0.0 → 1.1.0) | Existing shapes unchanged; new shape is additive. |

**Currently shipped:** `schema_version: "1.0.0"`. No prior schema versions exist. Artifacts produced by `@eval-kit/core < 0.3.x` predate the explicit version field and are interpreted as v1 by the reference implementation.

**v2 trigger:** the multi-reviewer support in v0.4 will be additive (`ReviewerAgreement` is a new top-level shape, `StepScore.reviewer_id` stays single-valued). No schema-v2 is planned through v0.5. v2 would only land if v0.5's `TrainingProposal` flow required restructuring an existing shape — which is not the current plan.

## Package-version policy (`@eval-kit/*`)

eval-kit follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) with pre-1.0 conventions made explicit:

| Range | Stability |
|---|---|
| **0.3.x** | Public API stable across the line. 0.3.y → 0.3.z will not break import paths or type shapes for documented exports. |
| **0.3.x → 0.4.0** | Minor bump may introduce new types (`ReviewerAgreement`, expanded `StepScore` fields). Existing types remain backward-compatible. |
| **0.4.x → 0.5.0** | Same. May introduce `RunLineage`, `TrainingProposal`. |
| **0.x → 1.0.0** | API lockdown release. Everything reachable from the package entry points becomes a stability commitment. |
| **1.x** | Strict semver. Breaking changes require a major bump and a documented deprecation period. |

### What counts as "public API" today

Everything exported from these entry points:

- `@eval-kit/core` — top-level `index.ts` exports
- `@eval-kit/core/agents` — agent-profile subpath
- `@eval-kit/ui` — React component exports
- The `eval-kit` CLI binary — its 8 subcommands and their flags

Internal modules (e.g. `packages/core/src/anthropic/*`) are **not** public API and may change in any release. If you find yourself importing from a deep path that isn't documented, assume it can break.

### Deprecation policy (effective at v1.0)

A deprecated symbol must:

1. Be marked `@deprecated` in JSDoc with a pointer to the replacement.
2. Remain functional for at least one minor release.
3. Be removed only in a major release with a CHANGELOG entry documenting the migration.

Pre-1.0, deprecations follow the spirit of this policy but are not strictly bound by it — see CHANGELOG for actual behavior per release.

## Supported runtime versions

| Runtime | Minimum | Tested in CI |
|---|---|---|
| Node.js | 20 LTS | 20, 22 |
| pnpm | 10 | 10.x |
| TypeScript (for consumers) | 5.0 | 5.7.3 internal |
| React (for `@eval-kit/ui` consumers) | 18 | 18.3 |
| Next.js (for `apps/dashboard`) | 15 | 15.x |

Node 18 is intentionally unsupported. The ESM-only module layout + `import("...")` dynamic imports + `node:fs/promises` usage assume Node 20.

## Supported security versions

| Version | Security patches |
|---|---|
| 0.3.x | ✅ (current) |
| < 0.3 | ❌ |

Once v1.0 ships, the policy expands to "latest two minor versions." See [`SECURITY.md`](../SECURITY.md) for disclosure.

## Migration policy (when a schema bump does land)

A schema-version bump requires:

1. **Migration script.** Committed under `scripts/migrate/v1-to-v2.mjs`. Reads v1 artifacts, emits v2 artifacts.
2. **Backward-compat reader.** The reference implementation reads both versions for at least one minor release after the bump.
3. **CHANGELOG entry.** Under a `### Migration` subsection explaining the change, the script, and any data loss caveats.
4. **CLI flag.** `eval-kit migrate runs/ --from v1 --to v2` runs the migration in-place on a directory.
5. **Docs update.** `SCHEMA.md` updated; old version preserved under `docs/schema-v1.md` so consumers still on v1 have reference material.

No schema bumps have shipped. This policy is the commitment for when one does.

## Backward compatibility — what we WILL break

A short list of things eval-kit *will* break across the 0.x line, even within a minor:

- Internal module paths (`packages/core/src/**` outside of documented exports).
- Dashboard UI internals — routes, server actions, internal components.
- Behavior of the tier-2 LLM pre-fill — model choice, prompt format, confidence calibration.
- Default flag values in the CLI (e.g. `--min-tool-match` default), with a CHANGELOG note.
- The shape of CLI text output (humans read it; tools should parse the JSON artifact, not the stdout).

## Backward compatibility — what we WON'T break

Pre-1.0, these are best-effort. Post-1.0, these are commitments.

- The shape of artifacts the protocol describes (Run, ScoredRun, StepScore, EvalSuite, Dimension).
- The `AgentAdapter` interface and `AgentRunInput.prior_steps` semantics.
- CLI subcommand names (`run`, `review`, `diff`, `report`, `init`, `preflight`, `ci`, `export`).
- The YAML suite top-level structure (`suite: { id, version, ... }`).
- The 0–3 rubric.
- The five `Dimension` enum values.
- The `pre_filled` invariant (`true` → human edit → `false`).

## How to read a release

When `@eval-kit/core@X.Y.Z` ships, check three things:

1. **`schema_version` in the CHANGELOG header.** If it changed, expect a migration.
2. **The `### Breaking` section.** If it's empty (and X stayed the same), your code keeps working.
3. **The `### Deprecated` section.** Plan removals before the next major.

## Related docs

- [`docs/SCHEMA.md`](./SCHEMA.md) — the protocol the schema-version axis governs
- [`docs/GOVERNANCE.md`](./GOVERNANCE.md) — how breaking-change decisions are made
- [`CHANGELOG.md`](../CHANGELOG.md) — actual release history
- [`SECURITY.md`](../SECURITY.md) — security-supported version range
