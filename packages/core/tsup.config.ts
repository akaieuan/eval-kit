import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/schema.ts",
    "src/runner.ts",
    "src/scoring.ts",
    "src/loader.ts",
    "src/ci.ts",
    "src/export.ts",
    "src/rubric.ts",
    "src/cli.ts",
    "src/adapters/index.ts",
    "src/agents/index.ts",
    "src/anthropic/extract-task.ts",
    "src/anthropic/prefill-score.ts",
    "src/init/index.ts",
  ],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node20",
  splitting: false,
});
