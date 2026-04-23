import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { parseSuite, type EvalSuite } from "@eval-kit/core";
import { SUITES_DIR } from "./runs";

export interface SuiteFileEntry {
  file: string;
  path: string;
  suite: EvalSuite;
}

export async function listSuiteFiles(): Promise<SuiteFileEntry[]> {
  let entries: string[];
  try {
    entries = await readdir(SUITES_DIR);
  } catch {
    return [];
  }
  const out: SuiteFileEntry[] = [];
  for (const name of entries) {
    if (!name.endsWith(".yaml") && !name.endsWith(".yml")) continue;
    const path = join(SUITES_DIR, name);
    try {
      const raw = parse(await readFile(path, "utf8"));
      const suite = parseSuite(raw);
      out.push({ file: name, path, suite });
    } catch {
      // skip malformed
    }
  }
  return out;
}

export async function loadSuiteYaml(file: string): Promise<string> {
  return readFile(join(SUITES_DIR, file), "utf8");
}

export async function writeSuiteYaml(
  file: string,
  yaml: string,
): Promise<void> {
  // Validate before writing
  const parsed = parse(yaml);
  parseSuite(parsed);
  await writeFile(join(SUITES_DIR, file), yaml);
}

export function taskToYaml(task: unknown): string {
  return stringify(task);
}
