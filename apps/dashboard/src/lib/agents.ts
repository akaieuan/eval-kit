import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  agentProfileToYaml,
  listAgentProfilesIn,
  parseAgentProfile,
  type AgentProfile,
  type AgentProfileEntry,
} from "@eval-kit/core/agents";
import { parse as parseYaml } from "yaml";

export const AGENTS_DIR = resolve(process.cwd(), "..", "..", "agents");

export async function listAgents(): Promise<AgentProfileEntry[]> {
  return listAgentProfilesIn(AGENTS_DIR);
}

export async function loadAgentById(
  id: string,
): Promise<AgentProfileEntry | null> {
  const entries = await listAgents();
  return entries.find((e) => e.profile.agent.id === id) ?? null;
}

export async function writeAgentYaml(
  filename: string,
  yaml: string,
): Promise<AgentProfile> {
  const safe = filename.replace(/[^a-z0-9._-]/gi, "-");
  if (!safe.endsWith(".yaml") && !safe.endsWith(".yml")) {
    throw new Error("Filename must end with .yaml or .yml");
  }
  const profile = parseAgentProfile(parseYaml(yaml));
  await writeFile(join(AGENTS_DIR, safe), yaml);
  return profile;
}

export { agentProfileToYaml };
export type { AgentProfile, AgentProfileEntry };

export async function readAgentYaml(filename: string): Promise<string> {
  return readFile(join(AGENTS_DIR, filename), "utf8");
}
