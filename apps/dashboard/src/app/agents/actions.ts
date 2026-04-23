"use server";
import { revalidatePath } from "next/cache";
import { writeAgentYaml } from "@/lib/agents";

export async function saveAgentProfile(
  filename: string,
  yaml: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const profile = await writeAgentYaml(filename, yaml);
    revalidatePath("/agents");
    revalidatePath(`/agents/${profile.agent.id}`);
    return { ok: true, id: profile.agent.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "save failed",
    };
  }
}
