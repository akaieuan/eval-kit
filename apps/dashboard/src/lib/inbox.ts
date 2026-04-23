import type {
  EvalSuite,
  EvalTask,
  Run,
  ScoredRun,
  StepResult,
  StepScore,
} from "@eval-kit/core";
import { listRuns, loadSuiteById, type RunEntry } from "./runs";

export interface InboxItem {
  id: string;
  run_id: string;
  run_file: string;
  run_started_at: string;
  suite_id: string;
  task_id: string;
  task_title: string;
  is_distraction: boolean;
  step_n: number;
  step_prompt: string;
  agent_output_preview: string;
  auto_score: StepResult["auto_score"];
  score: StepScore | null;
  status: "unscored" | "pre_filled" | "reviewed";
  priority: number;
  signals: string[];
}

function previewOutput(s: string, n = 140): string {
  const one = s.replace(/\s+/g, " ").trim();
  if (one.length <= n) return one;
  return one.slice(0, n - 1) + "…";
}

function stepStatus(score: StepScore | null | undefined): InboxItem["status"] {
  if (!score) return "unscored";
  if (score.pre_filled) return "pre_filled";
  return "reviewed";
}

function computePriority(args: {
  status: InboxItem["status"];
  is_distraction: boolean;
  auto_score: StepResult["auto_score"];
  score: StepScore | null;
}): { priority: number; signals: string[] } {
  const signals: string[] = [];
  let p = 0;

  // unscored items dominate
  if (args.status === "unscored") {
    p += 0.5;
    signals.push("unscored");
  }
  // pre_filled needs human verification
  if (args.status === "pre_filled") {
    p += 0.3;
    signals.push("pre-fill awaiting review");
    // Triage weight: low-confidence drafts are higher priority for review.
    const conf = args.score?.pre_fill_confidence;
    if (typeof conf === "number") {
      p += (1 - conf) * 0.25;
      if (conf < 0.6) signals.push(`low confidence ${Math.round(conf * 100)}%`);
      else signals.push(`confidence ${Math.round(conf * 100)}%`);
    }
    // Disagreement signal: pre-fill scored high but auto-score says tools missed.
    const gt = args.score?.golden_truth ?? null;
    if (
      typeof gt === "number" &&
      gt >= 2 &&
      args.auto_score.tool_match === false
    ) {
      p += 0.12;
      signals.push("disagreement with auto-score");
    }
  }
  // distraction tasks are calibration-critical
  if (args.is_distraction) {
    p += 0.2;
    signals.push("distraction");
    if (args.auto_score.distraction_caught === false) {
      p += 0.15;
      signals.push("distraction missed by auto");
    }
  }
  // tool-match regressions
  if (args.auto_score.tool_match === false) {
    p += 0.12;
    signals.push("tools missed");
  } else if (args.auto_score.tool_match === "partial") {
    p += 0.05;
    signals.push("tools partial");
  }

  return { priority: Math.min(1, p), signals };
}

export interface InboxFilter {
  runId?: string;
  suiteId?: string;
  status?: InboxItem["status"];
  isDistraction?: boolean;
  search?: string;
}

export async function listInboxItems(
  filter: InboxFilter = {},
): Promise<InboxItem[]> {
  const runs = await listRuns();
  // A run_id often has both an unscored and scored artifact on disk. Prefer the
  // scored copy so the inbox reflects human review state — otherwise each step
  // emits twice and React keys collide.
  const byRunId = new Map<string, RunEntry>();
  for (const r of runs) {
    const existing = byRunId.get(r.run.run_id);
    if (!existing || (existing.status !== "scored" && r.status === "scored")) {
      byRunId.set(r.run.run_id, r);
    }
  }
  const deduped = Array.from(byRunId.values());
  const suiteCache = new Map<string, EvalSuite>();

  const out: InboxItem[] = [];
  for (const entry of deduped) {
    if (filter.runId && entry.run.run_id !== filter.runId) continue;
    if (filter.suiteId && entry.run.suite_id !== filter.suiteId) continue;

    let suite = suiteCache.get(entry.run.suite_id);
    if (!suite) {
      const loaded = await loadSuiteById(entry.run.suite_id);
      if (loaded) {
        suite = loaded;
        suiteCache.set(entry.run.suite_id, loaded);
      }
    }
    if (!suite) continue;

    for (const t of entry.run.task_results) {
      const task: EvalTask | undefined = suite.suite.tasks.find(
        (x) => x.id === t.task_id,
      );
      if (!task) continue;
      for (const sr of t.step_results) {
        const step = task.steps.find((s) => s.n === sr.step_n);
        if (!step) continue;
        const score = extractScore(entry, t.task_id, sr.step_n);
        const status = stepStatus(score);
        if (filter.status && filter.status !== status) continue;
        if (
          filter.isDistraction !== undefined &&
          filter.isDistraction !== task.is_distraction
        ) {
          continue;
        }
        const { priority, signals } = computePriority({
          status,
          is_distraction: task.is_distraction,
          auto_score: sr.auto_score,
          score: score ?? null,
        });

        const item: InboxItem = {
          id: `${entry.run.run_id}::${t.task_id}::${sr.step_n}`,
          run_id: entry.run.run_id,
          run_file: entry.file,
          run_started_at: entry.run.started_at,
          suite_id: entry.run.suite_id,
          task_id: t.task_id,
          task_title: task.initial_purpose,
          is_distraction: task.is_distraction,
          step_n: sr.step_n,
          step_prompt: step.prompt,
          agent_output_preview: previewOutput(sr.agent_final_output),
          auto_score: sr.auto_score,
          score: score ?? null,
          status,
          priority,
          signals,
        };

        if (filter.search) {
          const q = filter.search.toLowerCase();
          const hay = (
            item.step_prompt +
            " " +
            item.agent_output_preview +
            " " +
            item.task_title +
            " " +
            item.task_id
          ).toLowerCase();
          if (!hay.includes(q)) continue;
        }

        out.push(item);
      }
    }
  }

  // Reviewed items at the bottom; within tier, higher priority first, then newer run.
  out.sort((a, b) => {
    const sa = a.status === "reviewed" ? 1 : 0;
    const sb = b.status === "reviewed" ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.run_started_at.localeCompare(a.run_started_at);
  });

  return out;
}

function extractScore(
  entry: RunEntry,
  taskId: string,
  stepN: number,
): StepScore | null {
  if (entry.status !== "scored") return null;
  const run = entry.run as ScoredRun;
  const task = run.task_results.find((t) => t.task_id === taskId);
  const step = task?.step_results.find((s) => s.step_n === stepN);
  return step?.score ?? null;
}

export async function unreviewedCount(): Promise<number> {
  const items = await listInboxItems();
  return items.filter((i) => i.status !== "reviewed").length;
}

// Exposed for type narrowing in server actions
export type { Run, ScoredRun };
