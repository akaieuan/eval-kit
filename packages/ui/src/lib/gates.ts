import type { Run, ScoredRun, StepResult } from "@eval-kit/core";

/**
 * Gate totals for display.
 *
 * `aggregateScoredRun` returns *rates*; the UI needs raw counts. A compliance
 * rate reads as a grade ("92%" sounds like a B), while `11/12 honored` reads
 * as what it is: one unauthorized action. Mandated-gate compliance is
 * pass/fail per gate, so the count is the honest presentation and the
 * percentage is not — see README, "Two kinds of gate, never averaged".
 *
 * Precision and recall stay separate for the same reason. There is
 * deliberately no combined "gate score" here, and adding one would be a bug.
 */
export interface GateTotals {
  /** Mandated gates triggered across every step. 0 = none declared/triggered. */
  required: number;
  honored: number;
  violated: number;
  /** Discretionary: blockers declared, asks made, asks that matched a blocker. */
  blockers: number;
  asked: number;
  matched: number;
  /** Asks on steps with zero declared blockers — the over-asking signal. */
  unprompted: number;
  /** True when no step in the run carried any mandated-gate score at all. */
  noGatesDeclared: boolean;
}

const EMPTY: GateTotals = {
  required: 0,
  honored: 0,
  violated: 0,
  blockers: 0,
  asked: 0,
  matched: 0,
  unprompted: 0,
  noGatesDeclared: true,
};

/** Accumulate gate totals across any collection of step results. */
export function gateTotalsFromSteps(steps: Iterable<StepResult>): GateTotals {
  const out: GateTotals = { ...EMPTY };
  for (const step of steps) {
    const mandated = step.auto_score.gates.mandated;
    if (mandated) {
      out.noGatesDeclared = false;
      out.required += mandated.required.length;
      out.honored += mandated.honored.length;
      out.violated += mandated.violated.length;
    }
    const discretionary = step.auto_score.gates.discretionary;
    if (discretionary) {
      out.blockers += discretionary.blockers;
      out.asked += discretionary.asked;
      out.matched += discretionary.matched;
      out.unprompted += discretionary.unprompted;
    }
  }
  return out;
}

/** Accumulate gate totals across a whole run. */
export function gateTotals(run: Run | ScoredRun): GateTotals {
  return gateTotalsFromSteps(
    run.task_results.flatMap((t) => t.step_results as StepResult[]),
  );
}

/**
 * Was the tool call at `callIndex` authorized?
 *
 * Not as simple as "is its gate in `violated`". `violated` and `honored` each
 * hold one entry per gated CALL, so a gate id repeats, and a gate appears in
 * BOTH lists when one call under it was authorized and another was not. That
 * happens whenever an approval's budget runs out: `uses: 1` followed by two
 * refunds is one honored call and one violated call under a single gate.
 * Membership alone would paint the authorized call as a violation.
 *
 * `pairings` is what settles it, since it records which call each approval
 * actually covered. It is empty on artifacts recorded before pairings existed,
 * which is why the `violated` check comes first: those runs keep rendering
 * exactly as they did, rather than turning every gated call red.
 */
export function isCallAuthorized(
  mandated: { violated: string[]; pairings?: { callIndex: number }[] } | null,
  callIndex: number,
  gateId: string | null,
): boolean {
  if (gateId === null) return true; // not gated, nothing to authorize
  if (!mandated) return true;
  if (!mandated.violated.includes(gateId)) return true;
  return (mandated.pairings ?? []).some((p) => p.callIndex === callIndex);
}

/**
 * Format a count pair as `honored/required`. Returns null when nothing was
 * measured, so callers render an explicit "not assessed" rather than a zero
 * that reads like a clean result.
 */
export function formatRatio(hit: number, total: number): string | null {
  if (total === 0) return null;
  return `${hit}/${total}`;
}
