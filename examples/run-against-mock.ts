import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMockAdapter, runSuite } from "@eval-kit/core";
import { loadSuite } from "@eval-kit/core/loader";
import { researchAgentV1Path } from "@eval-kit/seed-suite";

async function main() {
  const suite = await loadSuite(researchAgentV1Path);
  const adapter = createMockAdapter({ model: "mock-pristine" });
  const run = await runSuite(suite, { adapter });

  const outDir = resolve(process.cwd(), "runs");
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(
    outDir,
    `${run.started_at.slice(0, 10)}-mock-pristine.json`,
  );
  await writeFile(outPath, JSON.stringify(run, null, 2));
  console.log(`Wrote ${outPath}`);

  const degradedAdapter = createMockAdapter({
    model: "mock-degraded",
    degraded: true,
  });
  const degraded = await runSuite(suite, { adapter: degradedAdapter });
  const degradedPath = resolve(
    outDir,
    `${degraded.started_at.slice(0, 10)}-mock-degraded.json`,
  );
  await writeFile(degradedPath, JSON.stringify(degraded, null, 2));
  console.log(`Wrote ${degradedPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
