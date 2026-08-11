"use client";
import type {
  Dimension,
  EvalStep,
  MandatedGate,
  RubricScore,
  StepResult,
  StepScore,
} from "@eval-kit/core";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../lib/cn.js";
import { Sparkles } from "lucide-react";
import { Badge } from "./primitives/badge.js";
import { Card } from "./primitives/card.js";
import { Kbd } from "./primitives/kbd.js";
import { Tooltip } from "./primitives/tooltip.js";
import { Textarea } from "./primitives/textarea.js";
import { DIMENSION_LABELS } from "./review/dimension-copy.js";
import { GateTimeline } from "./review/GateTimeline.js";
import { ScoreSlider } from "./ScoreSlider.js";

export interface StepReviewCardProps {
  step: EvalStep;
  result: StepResult;
  dimensions: Dimension[];
  isDistraction: boolean;
  /** Mandated gates declared on the parent task — drives the gate timeline. */
  mandatedGates?: MandatedGate[];
  score: StepScore | null;
  reviewerId: string;
  onChange: (partial: Partial<StepScore> & { step_n: number }) => void;
  /** Ref for keyboard focus management */
  focused?: boolean;
  autoFocusKeyboard?: boolean;
}

export function StepReviewCard({
  step,
  result,
  dimensions,
  isDistraction,
  mandatedGates = [],
  score,
  reviewerId,
  onChange,
  focused,
  autoFocusKeyboard,
}: StepReviewCardProps) {
  const [goldenTruth, setGoldenTruth] = useState<RubricScore | null>(
    score?.golden_truth ?? null,
  );
  const [dimScores, setDimScores] = useState<Partial<Record<Dimension, RubricScore>>>(
    (score?.dimensions as Partial<Record<Dimension, RubricScore>>) ?? {},
  );
  const [notes, setNotes] = useState(score?.reviewer_notes ?? "");
  const [distractionCaught, setDistractionCaught] = useState<boolean | null>(
    score?.distraction_caught ?? result.auto_score.distraction_caught,
  );

  // sync with incoming score changes
  useEffect(() => {
    if (score) {
      setGoldenTruth(score.golden_truth);
      setDimScores(score.dimensions as Partial<Record<Dimension, RubricScore>>);
      setNotes(score.reviewer_notes);
      setDistractionCaught(score.distraction_caught);
    }
  }, [score]);

  // push each edit upstream for autosave
  function push(changes: Partial<StepScore>) {
    onChange({
      step_n: step.n,
      tool_match: result.auto_score.tool_match,
      reviewer_id: reviewerId,
      reviewed_at: new Date().toISOString(),
      pre_filled: false,
      golden_truth: goldenTruth,
      dimensions: dimScores,
      distraction_caught: distractionCaught,
      reviewer_notes: notes,
      ...changes,
    } as Partial<StepScore> & { step_n: number });
  }

  // keyboard bindings when focused
  useEffect(() => {
    if (!focused || !autoFocusKeyboard) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
      const digit = ["0", "1", "2", "3"].indexOf(e.key);
      if (digit >= 0) {
        e.preventDefault();
        const v = digit as RubricScore;
        setGoldenTruth(v);
        push({ golden_truth: v });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, autoFocusKeyboard, dimScores, notes, distractionCaught]);

  const toolMatchLabel = useMemo(() => {
    const tm = result.auto_score.tool_match;
    if (tm === true) return { label: "matched", tone: "good" as const };
    if (tm === "partial") return { label: "partial", tone: "warn" as const };
    return { label: "missed", tone: "danger" as const };
  }, [result.auto_score.tool_match]);

  return (
    <Card
      className={cn(
        "p-5 transition-shadow",
        focused && "ring-1 ring-fg-muted/40",
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="font-mono label">
              Step {step.n}
            </span>
            <Badge variant={toolMatchLabel.tone}>
              tools {toolMatchLabel.label}
            </Badge>
            {result.auto_score.distraction_caught !== null && (
              <Badge
                variant={
                  result.auto_score.distraction_caught ? "good" : "danger"
                }
              >
                distraction{" "}
                {result.auto_score.distraction_caught ? "caught" : "missed"}
              </Badge>
            )}
            <span className="text-2xs text-fg-muted-2 tabular-nums">
              {result.latency_ms}ms
            </span>
          </div>
          <p className="text-[14px] leading-relaxed text-fg">{step.prompt}</p>
          <p className="mt-3 rounded-md border border-border/60 bg-bg px-3 py-2 text-xs text-fg-muted leading-relaxed">
            <span className="text-fg-muted-2">Golden truth —</span>{" "}
            {step.golden_truth}
          </p>
        </div>
      </header>

      <section className="mt-5">
        <div className="mb-2 text-[13px] text-fg-muted">
          Agent output
        </div>
        <pre className="max-h-48 overflow-auto rounded-md border border-border/60 bg-bg px-3 py-2.5 text-xs text-fg-muted whitespace-pre-wrap leading-relaxed">
          {result.agent_final_output}
        </pre>
      </section>

      <section className="mt-5">
        {/* The trace, in order, with gate calls interleaved. Ordering IS the
            compliance claim, so it is drawn rather than summarised — a
            reviewer can see approval precede the action, or fail to. */}
        <div className="mb-2 text-[13px] text-fg-muted">Trace</div>
        <GateTimeline result={result} mandatedGates={mandatedGates} />
      </section>

      <section className="mt-5 space-y-1.5 border-t border-border/60 pt-5">
        <div className="flex items-center justify-between pb-1.5">
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-light tracking-tight text-fg-strong">
              Scoring
            </div>
            {score?.pre_filled && (
              <Tooltip content="Suggested by Claude. Adjust or accept as-is — any edit flips it to your score.">
                <span className="inline-flex items-center gap-1 rounded border border-brand/40 bg-brand/10 px-1.5 py-0.5 font-mono text-2xs uppercase tracking-[0.14em] text-brand">
                  <Sparkles size={9} strokeWidth={1.5} /> AI draft
                </span>
              </Tooltip>
            )}
          </div>
          {focused && (
            <div className="flex items-center gap-1 text-2xs text-fg-muted-2">
              <Kbd>0</Kbd>–<Kbd>3</Kbd>
            </div>
          )}
        </div>
        {/* Legend on the first row only — repeating the words on every
            dimension below is noise once the scale is established. */}
        <ScoreSlider
          label="Golden truth"
          value={goldenTruth}
          showLegend
          onChange={(v) => {
            setGoldenTruth(v);
            push({ golden_truth: v });
          }}
        />
        {dimensions.map((dim) => (
          <ScoreSlider
            key={dim}
            label={DIMENSION_LABELS[dim]}
            dimension={dim}
            value={dimScores[dim] ?? null}
            onChange={(v) => {
              const next = { ...dimScores, [dim]: v };
              setDimScores(next);
              push({ dimensions: next });
            }}
          />
        ))}
        {isDistraction && (
          <div className="pt-1">
            <label className="flex items-center gap-2 text-[13px] text-fg-muted">
              Distraction caught (override)
              <select
                value={
                  distractionCaught === null
                    ? ""
                    : distractionCaught
                      ? "yes"
                      : "no"
                }
                onChange={(e) => {
                  const v =
                    e.target.value === ""
                      ? null
                      : e.target.value === "yes";
                  setDistractionCaught(v);
                  push({ distraction_caught: v });
                }}
                className="h-6 rounded-md border border-border bg-bg-elev px-2 text-xs text-fg"
              >
                <option value="">auto</option>
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </label>
          </div>
        )}
      </section>

      <section className="mt-4">
        <label className="mb-1.5 block text-[13px] text-fg-muted">
          Reviewer notes
        </label>
        <Textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            push({ reviewer_notes: e.target.value });
          }}
          rows={3}
          placeholder="Why did you score this way? What should a future reviewer know?"
        />
      </section>
    </Card>
  );
}
