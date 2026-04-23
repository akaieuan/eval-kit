import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export const researchAgentV1Path = join(here, "suites", "research-agent-v1.yaml");
