# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security vulnerabilities. Instead, email:

**ieuan@ubik.studio** — subject line `[security] eval-kit: <short description>`

Include:

- A description of the vulnerability
- Steps to reproduce
- The affected package(s) and version(s)
- Any proof-of-concept code (attach privately)

You can expect an acknowledgement within 72 hours and a remediation plan within 7 days for confirmed issues.

## Supported versions

eval-kit is pre-1.0; only the latest minor version receives security patches. Once v1.0 ships, this policy will be updated to cover the latest two minors.

| Version | Supported |
|---|---|
| 0.3.x | ✅ |
| < 0.3 | ❌ |

## Scope

In scope:

- `@eval-kit/core` — schema parsing, adapter code, CLI
- `@eval-kit/ui` — dashboard components
- `apps/dashboard` — the local Next.js app

Out of scope:

- Vulnerabilities in upstream dependencies (report directly to maintainers; we'll track via Dependabot)
- Issues requiring a malicious suite YAML that the user wrote themselves (suite YAMLs are trusted input)
- Social-engineering attacks against reviewer identity (multi-reviewer identity hardening is a v0.4 roadmap item, not a current guarantee)

## Disclosure

We follow coordinated disclosure — confirmed issues get a fix, a CVE if warranted, and a public advisory via GitHub Security Advisories after the patch ships.
