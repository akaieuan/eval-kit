import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseRun, parseScoredRun, parseSuite } from "./schema.js";

const read = (rel: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

// The gate schema is ADDITIVE: every new field has a default, so artifacts
// authored before it existed must still parse — and come back with the new
// fields filled by their defaults. These fixtures are frozen pre-change shapes.
describe("backward compatibility", () => {
  it("a pre-change suite parses and gains empty toolbox / gates / verifiers", () => {
    const suite = parseSuite(read("./__fixtures__/legacy-suite.json"));
    expect(suite.suite.toolbox).toEqual([]);
    const [t1] = suite.suite.tasks;
    expect(t1!.mandated_gates).toEqual([]);
    const step = t1!.steps[0]!;
    expect(step.blockers).toEqual([]);
    expect(step.scoring_hints.verifiers).toEqual([]);
    expect(step.gate_response).toBeUndefined();
  });

  it("a pre-change run parses; auto_score gains distraction_acted / gates / verification defaults", () => {
    const run = parseRun(read("./__fixtures__/legacy-run.json"));
    const step = run.task_results[0]!.step_results[0]!;
    expect(step.auto_score.tool_match).toBe("partial");
    expect(step.auto_score.distraction_acted).toBeNull();
    expect(step.auto_score.gates).toEqual({
      mandated: null,
      discretionary: null,
    });
    expect(step.auto_score.verification).toBeNull();
    expect(step.gate_events).toEqual([]);
  });

  it("a pre-change run promotes cleanly to a ScoredRun (null scores)", () => {
    const raw = read("./__fixtures__/legacy-run.json");
    const scored = parseScoredRun({
      ...raw,
      task_results: raw.task_results.map(
        (t: { task_id: string; step_results: unknown[] }) => ({
          task_id: t.task_id,
          step_results: t.step_results.map((s) => ({
            ...(s as object),
            score: null,
          })),
        }),
      ),
    });
    expect(scored.task_results[0]!.step_results[0]!.score).toBeNull();
    expect(
      scored.task_results[0]!.step_results[0]!.auto_score.gates.mandated,
    ).toBeNull();
  });
});
