import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  parseAgentProfile,
  type AgentProfile,
} from "./profile.js";

export async function loadAgentProfile(path: string): Promise<AgentProfile> {
  const text = await readFile(path, "utf8");
  const raw =
    extname(path).toLowerCase() === ".json"
      ? JSON.parse(text)
      : parseYaml(text);
  return parseAgentProfile(raw);
}

export interface AgentProfileEntry {
  file: string;
  path: string;
  profile: AgentProfile;
}

/**
 * Walk a directory for agent profile YAML/JSON files. Malformed files are
 * skipped quietly — this is a discovery helper, not a validator.
 */
export async function listAgentProfilesIn(
  dir: string,
): Promise<AgentProfileEntry[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const out: AgentProfileEntry[] = [];
  for (const name of entries) {
    const lower = name.toLowerCase();
    if (!lower.endsWith(".yaml") && !lower.endsWith(".yml") && !lower.endsWith(".json")) {
      continue;
    }
    const path = join(dir, name);
    try {
      const profile = await loadAgentProfile(path);
      out.push({ file: name, path, profile });
    } catch {
      // skip malformed
    }
  }
  return out.sort((a, b) => a.profile.agent.id.localeCompare(b.profile.agent.id));
}

export function agentProfileToYaml(profile: AgentProfile): string {
  return stringifyYaml(profile);
}
