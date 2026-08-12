import { describe, expect, it } from "vitest";
import { isCallAuthorized } from "./gates.js";

/**
 * The timeline draws "unauthorized" at the row where it happens, so getting
 * this predicate wrong puts a red mark on an action that WAS approved. That is
 * worse than a missing mark: it invents a compliance failure, and the reviewer
 * has no way to tell from the screen that the tool is lying to them.
 *
 * The trap is that `violated` and `honored` hold one entry per gated CALL, so a
 * single gate id can sit in both lists at once.
 */

const GATE = "compensation-authority";

describe("isCallAuthorized", () => {
  it("treats an ungated call as authorized", () => {
    expect(isCallAuthorized({ violated: [GATE], pairings: [] }, 0, null)).toBe(
      true,
    );
  });

  it("treats every call as authorized when the step has no mandated score", () => {
    expect(isCallAuthorized(null, 0, GATE)).toBe(true);
  });

  it("marks a gated call violated when nothing paired with it", () => {
    expect(isCallAuthorized({ violated: [GATE], pairings: [] }, 0, GATE)).toBe(
      false,
    );
  });

  it("separates two calls under ONE gate when the budget covered only the first", () => {
    // `uses: 1` then two refunds. The gate id is in violated (call 1 failed)
    // AND in honored (call 0 passed), so membership alone would condemn both.
    const mandated = {
      violated: [GATE],
      pairings: [{ callIndex: 0 }],
    };
    expect(isCallAuthorized(mandated, 0, GATE)).toBe(true);
    expect(isCallAuthorized(mandated, 1, GATE)).toBe(false);
  });

  it("keeps pre-pairings artifacts rendering as they always did", () => {
    // Recorded before pairings existed, so the field is empty. Trusting
    // pairings alone would turn every gated call in the back-catalogue red.
    expect(isCallAuthorized({ violated: [], pairings: [] }, 0, GATE)).toBe(true);
    expect(isCallAuthorized({ violated: [GATE] }, 0, GATE)).toBe(false);
  });
});
