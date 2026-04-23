import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["react", "react-dom", "@eval-kit/core"],
  banner: {
    // The dist bundle mixes client-only components (Popover, Dialog, CommandPalette,
    // InlineHelp, etc.) with pure ones. Marking the whole package client-side lets
    // Next.js RSC import any export without tripping on nested hooks.
    js: '"use client";',
  },
});
