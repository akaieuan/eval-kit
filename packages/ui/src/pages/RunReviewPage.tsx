"use client";
import type {
  Dimension,
  EvalSuite,
  Run,
  ScoredRun,
  StepScore,
} from "@eval-kit/core";
import { mergeScores } from "@eval-kit/core";
import { Sparkles } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "../components/primitives/button.js";
import { InlineHelp } from "../components/primitives/inline-help.js";
import {
  AutosaveBadge,
  type AutosaveStatus,
} from "../components/review/AutosaveBadge.js";
import { TaskProgressItem } from "../components/review/TaskProgressItem.js";
import { StepReviewCard } from "../components/StepReviewCard.js";

export interface InitialScoreEntry {
  task_id: string;
  score: StepScore;
}

export type PrefillResult =
  | {
      step_n: number;
      ok: true;
      score: StepScore;
      confidence?: number;
    }
  | { step_n: number; ok: false; error: string };

export interface RunReviewPageProps {
  suite: EvalSuite;
  run: Run;
  reviewerId: string;
  initialScores?: InitialScoreEntry[];
  onScoreChange?: (scored: ScoredRun) => Promise<void> | void;
  /** Called when user clicks "Pre-fill" for a task. Returns the pre-filled scores. */
  onPrefillTask?: (taskId: string) => Promise<PrefillResult[]>;
  saving?: boolean;
  savedAt?: Date | null;
  saveError?: string | null;
  /** Whether the prefill feature is available (e.g. env key set) */
  prefillAvailable?: boolean;
}

export function RunReviewPage({
  suite,
  run,
  reviewerId,
  initialScores = [],
  onScoreChange,
  onPrefillTask,
  saving,
  savedAt,
  saveError,
  prefillAvailable,
}: RunReviewPageProps) {
  const [activeTaskId, setActiveTaskId] = useState<string>(
    run.task_results[0]?.task_id ?? "",
  );
  const [activeStepN, setActiveStepN] = useState<number>(
    run.task_results[0]?.step_results[0]?.step_n ?? 1,
  );
  const [scores, setScores] = useState<Map<string, Map<number, StepScore>>>(
    () => {
      const m = new Map<string, Map<number, StepScore>>();
      for (const { task_id, score } of initialScores) {
        const inner = m.get(task_id) ?? new Map<number, StepScore>();
        inner.set(score.step_n, score);
        m.set(task_id, inner);
      }
      return m;
    },
  );
  const [prefilling, setPrefilling] = useState(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  const activeTask = useMemo(
    () => suite.suite.tasks.find((t) => t.id === activeTaskId),
    [suite, activeTaskId],
  );
  const activeResult = useMemo(
    () => run.task_results.find((r) => r.task_id === activeTaskId),
    [run, activeTaskId],
  );

  const stepCursor = useMemo(() => {
    const out: { taskId: string; stepN: number }[] = [];
    for (const tr of run.task_results) {
      for (const sr of tr.step_results) {
        out.push({ taskId: tr.task_id, stepN: sr.step_n });
      }
    }
    return out;
  }, [run]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doSave = useCallback(
    (next: Map<string, Map<number, StepScore>>) => {
      if (!onScoreChange) return;
      const scored = mergeScores(run, next);
      void onScoreChange(scored);
    },
    [onScoreChange, run],
  );

  function upsertScore(
    taskId: string,
    partial: Partial<StepScore> & { step_n: number },
    opts: { fromUser?: boolean; prefill?: boolean } = { fromUser: true },
  ) {
    setScores((prev) => {
      const next = new Map(prev);
      const inner = new Map(next.get(taskId) ?? []);
      const existing = inner.get(partial.step_n);
      const merged: StepScore = {
        step_n: partial.step_n,
        tool_match:
          partial.tool_match ??
          existing?.tool_match ??
          run.task_results
            .find((t) => t.task_id === taskId)
            ?.step_results.find((s) => s.step_n === partial.step_n)?.auto_score
            .tool_match ??
          false,
        golden_truth: partial.golden_truth ?? existing?.golden_truth ?? null,
        distraction_caught:
          partial.distraction_caught ?? existing?.distraction_caught ?? null,
        dimensions:
          (partial.dimensions as Partial<Record<Dimension, 0 | 1 | 2 | 3>>) ??
          existing?.dimensions ??
          {},
        reviewer_notes: partial.reviewer_notes ?? existing?.reviewer_notes ?? "",
        reviewer_id: partial.reviewer_id ?? existing?.reviewer_id ?? reviewerId,
        reviewed_at: partial.reviewed_at ?? new Date().toISOString(),
        // Critical: any user edit flips pre_filled to false.
        pre_filled: opts.prefill
          ? true
          : opts.fromUser
            ? false
            : (partial.pre_filled ?? existing?.pre_filled ?? false),
      };
      inner.set(partial.step_n, merged);
      next.set(taskId, inner);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => doSave(next), 500);
      return next;
    });
  }

  async function handlePrefill() {
    if (!onPrefillTask || !activeTaskId) return;
    setPrefillError(null);
    setPrefilling(true);
    try {
      const results = await onPrefillTask(activeTaskId);
      setScores((prev) => {
        const next = new Map(prev);
        const inner = new Map(next.get(activeTaskId) ?? []);
        for (const r of results) {
          if (!r.ok) continue;
          // Only pre-fill steps that haven't been human-scored.
          const existing = inner.get(r.step_n);
          if (existing && existing.pre_filled === false) continue;
          inner.set(r.step_n, r.score);
        }
        next.set(activeTaskId, inner);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => doSave(next), 500);
        return next;
      });
      const errs = results.filter((r) => !r.ok);
      if (errs.length > 0) {
        setPrefillError(
          `${errs.length}/${results.length} steps failed. ${errs[0]!.ok === false ? errs[0]!.error : ""}`,
        );
      }
    } catch (err) {
      setPrefillError(err instanceof Error ? err.message : "prefill failed");
    } finally {
      setPrefilling(false);
    }
  }

  // #step-N deep link: set the active task + step based on the hash, then
  // scroll into view in a follow-up effect once the DOM reflects the new state.
  const pendingScrollRef = useRef<number | null>(null);
  useEffect(() => {
    function jumpToHash() {
      const hash =
        typeof window !== "undefined" ? window.location.hash : "";
      const m = /^#step-(\d+)$/.exec(hash);
      if (!m) return;
      const target = Number(m[1]);
      const hit = stepCursor.find((c) => c.stepN === target);
      if (!hit) return;
      setActiveTaskId(hit.taskId);
      setActiveStepN(hit.stepN);
      pendingScrollRef.current = target;
    }
    jumpToHash();
    window.addEventListener("hashchange", jumpToHash);
    return () => window.removeEventListener("hashchange", jumpToHash);
  }, [stepCursor]);

  useEffect(() => {
    const target = pendingScrollRef.current;
    if (target === null || target !== activeStepN) return;
    // Double-RAF to outrun any router-level scroll restoration, then scroll.
    const r1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`step-${target}`);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        pendingScrollRef.current = null;
      });
    });
    return () => cancelAnimationFrame(r1);
  }, [activeTaskId, activeStepN]);

  // j/k step navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "TEXTAREA" ||
          t.tagName === "INPUT" ||
          t.tagName === "SELECT")
      )
        return;
      const idx = stepCursor.findIndex(
        (c) => c.taskId === activeTaskId && c.stepN === activeStepN,
      );
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = stepCursor[Math.min(stepCursor.length - 1, idx + 1)];
        if (next) {
          setActiveTaskId(next.taskId);
          setActiveStepN(next.stepN);
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = stepCursor[Math.max(0, idx - 1)];
        if (next) {
          setActiveTaskId(next.taskId);
          setActiveStepN(next.stepN);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTaskId, activeStepN, stepCursor]);

  const status: AutosaveStatus = saveError
    ? "error"
    : saving
      ? "saving"
      : savedAt
        ? "saved"
        : "idle";

  function finalize() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    doSave(scores);
  }

  return (
    <div className="grid h-full grid-cols-[clamp(220px,18vw,280px)_minmax(0,1fr)] gap-0">
      <aside className="sticky top-11 h-[calc(100dvh-44px)] overflow-y-auto border-r border-border/70 bg-bg p-3">
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="text-2xs uppercase tracking-wider text-fg-muted-2">
            Tasks
          </div>
          <AutosaveBadge
            status={status}
            savedAt={savedAt}
            errorMessage={saveError ?? undefined}
          />
        </div>
        <ul className="space-y-px">
          {run.task_results.map((t) => {
            const task = suite.suite.tasks.find((s) => s.id === t.task_id);
            const scoredCount = [...(scores.get(t.task_id)?.values() ?? [])]
              .filter((s) => !s.pre_filled).length;
            return (
              <li key={t.task_id}>
                <TaskProgressItem
                  taskId={t.task_id}
                  title={task?.initial_purpose ?? t.task_id}
                  stepsScored={scoredCount}
                  stepsTotal={t.step_results.length}
                  isDistraction={task?.is_distraction}
                  active={t.task_id === activeTaskId}
                  onClick={() => {
                    setActiveTaskId(t.task_id);
                    setActiveStepN(t.step_results[0]?.step_n ?? 1);
                  }}
                />
              </li>
            );
          })}
        </ul>
        <div className="mt-5 space-y-2 border-t border-border/60 pt-4">
          <Button variant="primary" className="w-full" onClick={finalize}>
            Save scored run
          </Button>
          <div className="px-1 text-2xs text-fg-muted-2 leading-relaxed">
            Scores autosave as you edit. Use this to force-save immediately.
          </div>
        </div>
      </aside>

      <section className="min-w-0 overflow-y-auto px-[clamp(1.25rem,3vw,3rem)] py-6">
        <InlineHelp
          id="review-intro"
          title="You are the judge"
          variant="accent"
          className="mb-4"
        >
          Score each step on a 0–3 rubric. Press{" "}
          <kbd className="font-mono">1</kbd>–<kbd className="font-mono">3</kbd>{" "}
          for golden truth, <kbd className="font-mono">j</kbd>/
          <kbd className="font-mono">k</kbd> to move between steps. Hover the
          info icon on any dimension for examples.
        </InlineHelp>

        {onPrefillTask && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-border/80 bg-bg-elev px-4 py-3">
            <div className="flex flex-col">
              <div className="text-xs text-fg-strong">
                AI pre-fill (optional)
              </div>
              <div className="mt-0.5 text-2xs text-fg-muted leading-relaxed">
                Claude drafts scores for this task. You accept or override.
                Pre-filled scores are marked "AI draft" until you edit them.
              </div>
            </div>
            <div className="flex items-center gap-2">
              {prefillError && (
                <span className="text-2xs text-danger">{prefillError}</span>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={prefilling || !prefillAvailable}
                onClick={handlePrefill}
              >
                <Sparkles size={11} strokeWidth={1.5} />
                {prefilling
                  ? "Drafting…"
                  : prefillAvailable
                    ? "Pre-fill task"
                    : "ANTHROPIC_API_KEY not set"}
              </Button>
            </div>
          </div>
        )}

        {activeTask && activeResult ? (
          <div className="space-y-4 pb-20">
            <div>
              <div className="font-mono text-2xs uppercase tracking-wider text-fg-muted-2">
                {activeTask.id}
              </div>
              <h2 className="mt-1 text-[18px] font-light tracking-tight text-fg-strong">
                {activeTask.initial_purpose}
              </h2>
              <p className="mt-2 max-w-2xl text-xs text-fg-muted leading-relaxed">
                {activeTask.overall_goal}
              </p>
            </div>

            {activeResult.step_results.map((sr) => {
              const step = activeTask.steps.find((s) => s.n === sr.step_n);
              if (!step) return null;
              const dims =
                step.scoring_hints.dimensions.length > 0
                  ? step.scoring_hints.dimensions
                  : suite.suite.dimensions_in_scope;
              const isFocused =
                sr.step_n === activeStepN && activeTask.id === activeTaskId;
              const currentScore =
                scores.get(activeTask.id)?.get(sr.step_n) ?? null;
              return (
                <div
                  key={sr.step_n}
                  id={`step-${sr.step_n}`}
                  onClick={() => setActiveStepN(sr.step_n)}
                >
                  <StepReviewCard
                    step={step}
                    result={sr}
                    dimensions={dims}
                    isDistraction={activeTask.is_distraction}
                    score={currentScore}
                    reviewerId={reviewerId}
                    focused={isFocused}
                    autoFocusKeyboard={isFocused}
                    onChange={(partial) =>
                      upsertScore(activeTask.id, partial, { fromUser: true })
                    }
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-fg-muted">Select a task.</p>
        )}
      </section>
    </div>
  );
}
