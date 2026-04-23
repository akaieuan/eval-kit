import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { parseRun, parseScoredRun, parseSuite } from "./schema.js";
import type { EvalSuite, Run, ScoredRun } from "./schema.js";

export async function loadSuite(path: string): Promise<EvalSuite> {
  const text = await readFile(path, "utf8");
  const raw = path.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
  return parseSuite(raw);
}

export async function loadRun(path: string): Promise<Run> {
  const text = await readFile(path, "utf8");
  return parseRun(JSON.parse(text));
}

export async function loadScoredRun(path: string): Promise<ScoredRun> {
  const text = await readFile(path, "utf8");
  return parseScoredRun(JSON.parse(text));
}
