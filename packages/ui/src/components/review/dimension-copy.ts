// Re-exports from @eval-kit/core/rubric — the UI package is marked "use client"
// in its dist bundle, which would prevent server components from safely
// importing these constants. Consumers who need the data directly from a
// server component should import from "@eval-kit/core" or "@eval-kit/core/rubric"
// instead of from "@eval-kit/ui".
export {
  DIMENSION_LABELS,
  DIMENSION_DESCRIPTIONS,
  DIMENSION_RUBRIC_EXAMPLES,
  DIMENSION_ORDER,
} from "@eval-kit/core";
