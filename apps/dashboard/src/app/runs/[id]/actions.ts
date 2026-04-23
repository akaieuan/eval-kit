"use server";
import { revalidatePath } from "next/cache";
import { parseScoredRun, type ScoredRun } from "@eval-kit/core";
import { writeScoredRun } from "@/lib/runs";

export async function saveScoredRun(payload: unknown): Promise<{
  ok: true;
  path: string;
} | { ok: false; error: string }> {
  try {
    const scored: ScoredRun = parseScoredRun(payload);
    const path = await writeScoredRun(scored);
    revalidatePath("/");
    revalidatePath(`/runs/${scored.run_id}`);
    return { ok: true, path };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}
