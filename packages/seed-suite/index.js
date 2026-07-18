import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export const researchAgentV1Path = join(here, "suites", "research-agent-v1.yaml");
export const codingAgentV1Path = join(here, "suites", "coding-agent-v1.yaml");
export const supportAgentV1Path = join(here, "suites", "support-agent-v1.yaml");

export function suitePath(name) {
  return join(here, "suites", `${name}.yaml`);
}
