# RFC 0002 — Gate visibility + akaOSS restyle

- **Status:** proposed (2026-08-11)
- **Scope:** `apps/dashboard`, `packages/ui`, `packages/seed-suite`
- **Depends on:** 0.4.0 gates (shipped). Independent of the v0.5.0 calibration work; can land before or alongside it.

## 1. Should eval-kit have a frontend at all?

Yes, and the reasons are structural rather than cosmetic — recorded here because the question was asked directly.

1. **The scoring UI is the operational form of the first guardrail.** "Humans score, not LLMs" is a text file until there is a surface that makes human scoring fast enough to actually happen. The keyboard-first review flow *is* the guardrail, shipped.
2. **Review throughput is the binding constraint on rare-event measurement.** In the authorization settings the framework targets, errors are rare (see ROADMAP v0.6.0). At a 1% error rate, useful denominators mean thousands of reviewed decisions. Every second shaved off a review multiplies directly into statistical power. A CLI cannot do this; a purpose-built queue can.
3. **The instrument currently has a reading it does not display.** Core computes `mandated_compliance_rate`, `discretionary_ask_precision`, and `discretionary_blocker_recall` — and every UI surface throws them away (`StatCardGroup` renders four cards, none of them gates; `RunTableRow` has no gate column; `StepReviewCard` never touches `gate_events`). The 0.4.0 release is invisible in the product. That is the most urgent single fact about the dashboard.

So the frontend is not an accessory to the framework — for the two claims that differentiate it (humans score; the gate is the unit), the frontend is the proof. What follows is the plan to make it show the gates and look like it belongs to the family.

## 2. Phase A — gate visibility (the substance)

Ordered so every step ships something visible.

**A1. Seed data first.** The three reference suites declare zero `mandated_gates` and zero `blockers`, so any gate UI would render empty state on every shipped suite. Extend `support-agent-v1` (refund and security-escalation tasks are natural mandated gates; policy-gap questions are natural blockers) and add at least one gated task to `coding-agent-v1` (destructive-migration approval). Regenerate the pristine/degraded demo runs so the diff view exercises gate regressions. *No schema changes — the schema is done.*

**A2. Stat surfaces.** `packages/ui/src/components/home/StatCardGroup.tsx` gains three gate cards fed from `SuiteAggregate`: mandated compliance, ask precision, blocker recall. Three cards, never a combined number — the never-averaged rule is a UI rule too. `RunTableRow` gains a gate column (compliance shown as `honored/required`, not a percentage, so 11/12 reads as "one violation" rather than "92%").

**A3. The gate timeline in review.** `StepReviewCard` renders `gate_events` inline with tool calls, in trace order, so the reviewer *sees* ordering: `request_approval` → approval → gated call reads as honored; gated call with no prior approval reads as violated, in the danger tone. This is the surface that makes "approval preceded action" a thing a human can check at a glance. Use the phase/tone vocabulary already designed in akaoss `src/components/inertial/MandatedGate.tsx` (`pending / approved / executed / denied / escalated`).

**A4. Empty states that say why.** A run whose suite declares no gates shows "no gates declared in this suite," not a dash — absence of measurement is stated, never blank (research № 007's rule applied to the UI).

## 3. Phase B — akaOSS restyle (the skin)

The exploration established the dashboard owns almost no tokens: everything flows from `packages/ui/src/styles/tokens.css` + `packages/ui/tailwind.config.ts`. That makes this cheap.

**B1. Tokens.** Retint `tokens.css` to the akaOSS palette (akaoss `src/app/globals.css`): warm near-black dark / warm paper light on oklch hue 107, five accents as punctuation-never-fills. Note the mechanical constraint: eval-kit's Tailwind v3 setup needs `R G B` triples for alpha syntax, so the oklch values must be converted to sRGB triples — record the mapping in a comment so the source of truth stays akaoss.

**B2. Type.** Add `next/font` Inter + JetBrains Mono in `apps/dashboard/src/app/layout.tsx` (today no font is actually loaded — `--font-sans` points at nothing). Adopt the two-weight system (`font-light` headings, `font-medium` emphasis) and the `.label` mono micro-label idiom. Adopt the semantic rule stated in akaoss `inertial/ui.tsx`: machine data (ids, hashes, scores, tool names) is mono; human voice is sans.

**B3. Surfaces.** Cards to `rounded-2xl border-border/40 bg-card/40`, buttons `rounded-md`, pills `rounded-full`, hairline section dividers — the akaoss conventions verbatim.

**B4. Fix the real defects found during exploration, in the same pass:**
- `focus-visible:focus-ring` is referenced in `button.tsx` and `tabs.tsx` but the utility is defined nowhere — focus rings on those components are currently no-ops. Define it.
- The 7-column run-table grid is duplicated between `packages/ui/src/pages/DashboardPage.tsx` and `apps/dashboard/src/app/runs/page.tsx` — extract once into the package.
- `Shell.tsx` forks its own `ShortcutsOverlay` instead of using the package's; reunify.
- `APP_VERSION = "0.2.0"` is hardcoded in `Shell.tsx`; read it from `package.json`.

## 4. Explicitly out of scope

- The standalone `npx @eval-kit/dashboard` bin — that is v0.5.0 (ROADMAP), and restyling first means the standalone ships looking right.
- Any schema change. Phases A and B consume 0.4.0 as-is.
- `/agreement`, κ, multi-reviewer — v0.5.0.

## 5. Verification

- `pnpm -r build && pnpm -r typecheck && pnpm -r test` (the ui API surface will change: `pnpm api:check` snapshot must be updated deliberately, not regenerated blindly)
- `pnpm verify:goldens` — A1's regenerated demo runs must replay byte-stable
- Regenerate README screenshots via `scripts/capture-screenshots.mjs` — the current set is dated 2026-05-08 and predates gates entirely
- Manual: a violated mandated gate in the degraded demo run must be findable in under ten seconds from the dashboard home, keyboard only

## 6. Sequencing note

A before B if forced to choose — substance before skin. But B1–B2 are a day's work with the token map already extracted, so the intended path is one branch per phase, A first, review each against this document.
