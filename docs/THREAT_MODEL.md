# Threat model

This document is the **security boundary spec** for eval-kit. It describes what eval-kit protects against, what it does not, and what assumptions its security posture rests on.

For disclosure procedure, see [`SECURITY.md`](../SECURITY.md).

## TL;DR

eval-kit is a **file-based, single-user, internal-team tool**. It is not a hosted service, has no authentication, no multi-tenancy, and no network listener beyond an opt-in local Next.js dev server. The threat model reflects that posture.

If you run eval-kit on a personal or team laptop, the threat surface is essentially the same as any other Node.js dev tool. If you run it in CI, the threat surface is the GitHub Actions runner and the API keys you give it.

## Assets

What eval-kit holds that an attacker might want:

| Asset | Sensitivity | Location |
|---|---|---|
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (and similar) | High | Environment variables passed to the runner / dashboard |
| Custom adapter source code | Medium | User's repo, under `adapters/` or wherever they choose |
| Suite YAMLs | Low (typically internal IP about what a team measures) | User's repo, under `suites/` |
| Run artifacts (`runs/*.json`, `runs/*.scored.json`) | Low to Medium (may contain agent outputs from real workflows) | User's repo, under `runs/` |
| Reviewer notes | Low (free-text scoring notes) | Embedded in scored-run artifacts |

## In scope — vulnerabilities eval-kit considers its responsibility

### 1. Schema parsing safety

Untrusted JSON or YAML passed to `parseSuite` / `parseRun` / `parseScoredRun` must not:

- Cause the parser to consume unbounded memory.
- Cause prototype pollution.
- Throw uncaught exceptions that crash a long-running process (dashboard).

Mitigated by: Zod is the only parser; Zod's behavior here is well-understood and tested.

### 2. Adapter loading safety

`--adapter ./path.mjs` performs a dynamic import. The loaded module:

- Receives no special privilege beyond what the runner process has.
- Is not sandboxed.
- Can do anything Node can do.

**This is intentional.** Adapters are meant to be authored by the eval-kit user against their own agents. The trust boundary is "user controls their own adapter path."

Mitigated by: the README and CLI help text are explicit that `--adapter` should only point at code the user wrote or trusts.

### 3. CLI argument handling

The 8 CLI subcommands should not:

- Shell out via string interpolation.
- Write to paths outside what the user passed in.
- Silently overwrite an existing run artifact (the runner emits a warning and a fresh `run_id` if `--out` already exists).

### 4. Dashboard server-action surface

The Next.js dashboard exposes server actions for scoring, autosave, and pre-fill triggering. These actions:

- Only write to the configured `runs/` directory.
- Do not accept arbitrary file paths from the client.
- Do not execute user-supplied code paths.

The dashboard binds to `localhost:3000` by default. Exposing it to a network is the user's choice and is documented as out-of-scope.

### 5. Dependency safety

- Dependencies are tracked via `pnpm-lock.yaml`, committed to the repo.
- Dependabot is configured to surface advisories.
- A dependency advisory in a tier-1 path (zod, commander, Next.js framework, @anthropic-ai/sdk) is treated as a security issue.

## Out of scope — explicitly NOT eval-kit's responsibility

### 1. Malicious suite YAMLs the user authored

Suite YAMLs are **trusted input**. A user passing themselves a YAML that does weird things to their own scoring is not a vulnerability. (Adversarial YAML to crash *another* user's machine would be a vulnerability if there were a sharing mechanism — there isn't.)

### 2. Vulnerabilities in upstream SDKs

`@anthropic-ai/sdk`, `openai`, `next`, etc. are upstream. Report directly to those projects. eval-kit will bump dependency versions promptly when a fix lands.

### 3. Compromised reviewer machine

If a reviewer's machine is compromised, eval-kit cannot defend against altered scores, fabricated reviewer notes, or stolen artifacts. The scoring trust model assumes the reviewer is who they say they are. v0.4's multi-reviewer support adds inter-rater disagreement detection, which helps surface anomalies but is not a security control.

### 4. Hosted / multi-tenant scenarios

eval-kit is local-first by design. If a team builds a hosted variant, that team owns the auth, RBAC, isolation, and audit story. Upstream eval-kit will not add hosted-only features that change the threat model for local users.

### 5. Side channels

Timing attacks, cache attacks, etc. against the LLM adapters are not considered. Models can leak training data, refuse on inputs they shouldn't, etc. — that's an LLM-provider concern, not eval-kit's.

### 6. Tier-2 pre-fill prompt injection

The tier-2 LLM pre-fill sends agent outputs (`agent_final_output`) to an LLM to draft a score. A maliciously-crafted agent output could in theory inject a prompt into the pre-fill model. **This is by design unconstrained** — pre-fill output is always flagged `pre_filled: true` and the human-review step is the trust boundary. A reviewer who notices a suspicious pre-fill drafts a different score and the flag flips to false.

The point of the tier separation (see [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)) is exactly this: no automated tier is trusted; the human is the final word.

## Assumptions the model rests on

If any of these are violated, the threat model needs to be revisited:

1. **The reviewer is who they say they are.** No identity verification today; `StepScore.reviewer_id` is self-asserted.
2. **The user owns the machine running eval-kit.** No multi-tenant isolation.
3. **API keys live in env vars or a `.env` file under the user's control.** Not in the repo, not in artifacts.
4. **Run artifacts are not signed.** A scored-run artifact in a shared drive can be tampered with by anyone with write access to that drive.
5. **The dashboard is not network-exposed by default.** Exposing it requires the user to deliberately change Next.js host binding.

## Hardening checklist (for teams running eval-kit in CI)

If you're running `eval-kit ci` in production CI:

- [ ] Store `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` in GitHub Actions secrets, not in the workflow YAML.
- [ ] Pin `@eval-kit/core` to an exact version in your `package.json` — not a range.
- [ ] Pin the model in `--model claude-sonnet-4-5` rather than letting the adapter default change under you.
- [ ] Treat baseline scored-run artifacts as build artifacts; review changes to `runs/baseline.scored.json` like any other code change.
- [ ] If your suite YAMLs contain internal IP (research plans, customer scenarios), gate repo access accordingly.

## Reporting a vulnerability

See [`SECURITY.md`](../SECURITY.md). Short version: email `ieuan@ubik.studio` with subject `[security] eval-kit: <short description>`. Acknowledgement within 72 hours; remediation plan within 7 days for confirmed issues.

## Related docs

- [`SECURITY.md`](../SECURITY.md) — disclosure procedure
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — system boundaries
- [`docs/GOVERNANCE.md`](./GOVERNANCE.md) — how policy changes get made
- [`docs/COMPATIBILITY.md`](./COMPATIBILITY.md) — supported versions for security patches
