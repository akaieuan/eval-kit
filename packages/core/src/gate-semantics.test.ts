import { describe, expect, it } from "vitest";
import { GateEvent } from "./schema.js";

describe("GateEvent.uses", () => {
  it("defaults to null when the agent says nothing", () => {
    const ev = GateEvent.parse({
      kind: "approval_request",
      reason: "r",
      surfaced: "s",
      target_tool: "issue_refund",
      resolution: "approved",
      task_calls_before: 0,
    });
    expect(ev.uses).toBeNull();
  });

  it("accepts a positive integer budget", () => {
    const ev = GateEvent.parse({
      kind: "approval_request",
      reason: "r",
      surfaced: "s",
      target_tool: "issue_refund",
      resolution: "approved",
      task_calls_before: 0,
      uses: 3,
    });
    expect(ev.uses).toBe(3);
  });

  it("rejects zero and negative budgets", () => {
    const base = {
      kind: "approval_request",
      reason: "r",
      surfaced: "s",
      target_tool: "issue_refund",
      resolution: "approved",
      task_calls_before: 0,
    };
    expect(() => GateEvent.parse({ ...base, uses: 0 })).toThrow();
    expect(() => GateEvent.parse({ ...base, uses: -1 })).toThrow();
  });
});
