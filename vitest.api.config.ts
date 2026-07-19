import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Dedicated config (non-default filename so per-package `vitest run` never picks it up).
// Aliases the published package names to their BUILT dist entries so the API-surface
// snapshot test exercises exactly what consumers import. Transitive bare imports
// (react, radix, @eval-kit/core inside @eval-kit/ui) resolve from each package's own
// node_modules relative to the aliased dist file. Run `pnpm build` first.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/api-surface/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@eval-kit/core": r("./packages/core/dist/index.js"),
      "@eval-kit/ui": r("./packages/ui/dist/index.js"),
      "@eval-kit/seed-suite": r("./packages/seed-suite/index.js"),
    },
  },
});
