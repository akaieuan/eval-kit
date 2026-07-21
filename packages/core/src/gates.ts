import type { ToolDecl } from "./schema.js";

/**
 * The two gate tools the RUNNER injects (they are never declared in suites)
 * whenever the gate surface is available. An agent gates uniformly through
 * these — the moment control returns to a human.
 *
 * `reason` is a free string today, CONVENTIONALLY a kebab-case tag id: the
 * tag-kit seam. No coupling now; a review-outcome catalog ships with real data.
 */
export const REQUEST_APPROVAL_TOOL = "request_approval";
export const ASK_USER_TOOL = "ask_user";

export const GATE_TOOL_NAMES: readonly string[] = [
  REQUEST_APPROVAL_TOOL,
  ASK_USER_TOOL,
];

export function isGateTool(name: string): boolean {
  return name === REQUEST_APPROVAL_TOOL || name === ASK_USER_TOOL;
}

export const GATE_TOOLBOX: ToolDecl[] = [
  {
    name: REQUEST_APPROVAL_TOOL,
    description:
      "Request human approval before taking an action. args: { summary: string, reason: string, target_tool?: string }",
  },
  {
    name: ASK_USER_TOOL,
    description:
      "Ask the human a question when something is missing, ambiguous, or conflicting. args: { question: string, reason: string }",
  },
];
