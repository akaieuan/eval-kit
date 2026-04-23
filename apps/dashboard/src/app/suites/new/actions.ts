"use server";
import { extractTaskFromTranscript } from "@eval-kit/core/anthropic/extract-task";
import { stringify } from "yaml";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { SUITES_DIR } from "@/lib/runs";

export async function draftTaskFromTranscript(transcript: string): Promise<
  | { ok: true; yaml: string; taskId: string }
  | { ok: false; error: string }
> {
  const res = await extractTaskFromTranscript(transcript);
  if (!res.ok) return { ok: false, error: res.error };
  const yaml = stringify({ task: res.task });
  return { ok: true, yaml, taskId: res.task.id };
}

export async function saveNewSuite(
  filename: string,
  yaml: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const safeName = filename.replace(/[^a-z0-9._-]/gi, "-");
  if (!safeName.endsWith(".yaml") && !safeName.endsWith(".yml")) {
    return { ok: false, error: "Filename must end with .yaml or .yml" };
  }
  try {
    await writeFile(join(SUITES_DIR, safeName), yaml);
    revalidatePath("/suites");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "write failed",
    };
  }
}
