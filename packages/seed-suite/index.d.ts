/**
 * Absolute filesystem path to the packaged research-agent-v1 suite YAML.
 */
export const researchAgentV1Path: string;

/**
 * Absolute filesystem path to the packaged coding-agent-v1 suite YAML.
 */
export const codingAgentV1Path: string;

/**
 * Absolute filesystem path to the packaged support-agent-v1 suite YAML.
 */
export const supportAgentV1Path: string;

/**
 * Resolve the absolute path to any packaged suite by its file stem
 * (e.g. `suitePath("research-agent-v1")`).
 */
export function suitePath(name: string): string;
