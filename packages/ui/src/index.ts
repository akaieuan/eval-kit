// Primitives
export * from "./components/primitives/index.js";
// Layout primitives — page chrome. Routes should never hand-roll gutters,
// title blocks, section rhythm, or filter rows again.
export * from "./components/layout/index.js";
// The type scale: six named roles. See lib/type.ts for the rule.
export * as type from "./lib/type.js";
// Utilities
export { cn } from "./lib/cn.js";
export { isMac, modLabel, shortcutLabel } from "./lib/kbd.js";
// Shell (app shell, nav, command palette)
export * from "./components/shell/index.js";
export {
  PALETTES,
  readMode,
  readPalette,
  applyMode,
  applyPalette,
  type Mode,
  type Palette,
} from "./components/shell/ThemeToggle.js";
// Review / home / diff / inbox feature components
export * from "./components/review/index.js";
export * from "./components/home/index.js";
export * from "./components/diff/index.js";
export * from "./components/inbox/index.js";
// Pages
export { ScoreSlider } from "./components/ScoreSlider.js";
export { StepReviewCard } from "./components/StepReviewCard.js";
export {
  RunReviewPage,
  type InitialScoreEntry,
  type PrefillResult,
  type RunReviewPageProps,
} from "./pages/RunReviewPage.js";
export { DashboardPage } from "./pages/DashboardPage.js";
export { DiffPage } from "./pages/DiffPage.js";
