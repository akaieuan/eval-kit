import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import { parseSuite, type EvalSuite } from "./schema.js";
import { getVerifier } from "./verifiers/index.js";

/**
 * `@eval-kit/seed-suite` is published. Its YAML is hand-authored and nothing
 * validated it, so a malformed suite could ship and only fail inside a
 * consumer's runner. This walks every suite it exports and parses it with the
 * same Zod schema the runner uses, then checks the invariants the schema itself
 * is too permissive to express.
 *
 * It lives in core rather than in seed-suite because core owns the schema and
 * already has the test runner; seed-suite has no build and no test tooling, and
 * a second vitest install to guard three YAML files is not worth it.
 */

const suitesDir = fileURLToPath(
  new URL("../../seed-suite/suites", import.meta.url),
);
const suiteFiles = readdirSync(suitesDir).filter((f) => f.endsWith(".yaml"));

const cache = new Map<string, EvalSuite>();
function load(file: string): EvalSuite {
  let suite = cache.get(file);
  if (!suite) {
    suite = parseSuite(parseYaml(readFileSync(`${suitesDir}/${file}`, "utf8")));
    cache.set(file, suite);
  }
  return suite;
}

describe("published seed suites", () => {
  it("finds the suites directory and it is not empty", () => {
    // Without this a wrong path would make every it.each below vacuously pass.
    expect(suiteFiles.length).toBeGreaterThanOrEqual(3);
  });

  it.each(suiteFiles)("%s validates against the EvalSuite schema", (file) => {
    const suite = load(file);
    expect(suite.suite.id).toBeTruthy();
    expect(suite.suite.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(suite.suite.tasks.length).toBeGreaterThan(0);
  });

  it.each(suiteFiles)("%s declares an explicit toolbox", (file) => {
    // Without one the runner falls back to the union of expected_tools, which
    // hands the agent the answer key. Published suites must not rely on that.
    expect(load(file).suite.toolbox.length).toBeGreaterThan(0);
  });

  it.each(suiteFiles)("%s numbers its steps 1..n within each task", (file) => {
    for (const task of load(file).suite.tasks) {
      expect(task.steps.map((s) => s.n)).toEqual(
        task.steps.map((_, i) => i + 1),
      );
    }
  });

  it.each(suiteFiles)("%s references only registered verifiers", (file) => {
    // The schema accepts any string as a verifier id, so a typo survives
    // parsing and only explodes mid-run. This is where it gets caught.
    for (const task of load(file).suite.tasks) {
      for (const step of task.steps) {
        for (const ref of step.scoring_hints.verifiers) {
          expect(() => getVerifier(ref.id)).not.toThrow();
        }
      }
    }
  });

  it.each(suiteFiles)("%s gates only tools that exist in its toolbox", (file) => {
    const suite = load(file);
    const known = new Set(suite.suite.toolbox.map((t) => t.name));
    for (const task of suite.suite.tasks) {
      for (const gate of task.mandated_gates) {
        for (const tool of gate.before_tools) {
          expect(
            known,
            `${file} ${task.id}/${gate.id} gates a tool absent from the toolbox`,
          ).toContain(tool);
        }
      }
    }
  });

  it.each(suiteFiles)("%s expects only tools that exist in its toolbox", (file) => {
    const suite = load(file);
    const known = new Set(suite.suite.toolbox.map((t) => t.name));
    for (const task of suite.suite.tasks) {
      for (const step of task.steps) {
        for (const tool of step.expected_tools) {
          expect(
            known,
            `${file} ${task.id} step ${step.n} expects an unofferable tool`,
          ).toContain(tool);
        }
      }
    }
  });
});
