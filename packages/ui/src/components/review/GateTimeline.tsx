import type { GateEvent, MandatedGate, StepResult, ToolCall } from "@eval-kit/core";
import { cn } from "../../lib/cn.js";
import { isCallAuthorized } from "../../lib/gates.js";
import { MICRO, MONO } from "../../lib/type.js";

export interface GateTimelineProps {
  result: StepResult;
  /** Mandated gates declared on the task this step belongs to. */
  mandatedGates: MandatedGate[];
  className?: string;
}

type Entry =
  | { kind: "gate"; event: GateEvent; at: number }
  | { kind: "tool"; call: ToolCall; at: number; gated: string | null };

/**
 * The agent's actions and its gate calls, interleaved in the order they
 * happened.
 *
 * This is the surface that makes mandated-gate compliance checkable by a
 * human rather than merely computed. The scorer already knows whether approval
 * preceded the gated call — `GateEvent.task_calls_before` records how many task
 * actions came first — but until now no screen showed it, so a reviewer had to
 * take the verdict on trust. Ordering is the whole claim, so ordering is what
 * gets drawn.
 *
 * A gated call with no prior approval is marked in the destructive tone at the
 * exact row where the violation occurs, not summarised at the top.
 */
export function GateTimeline({
  result,
  mandatedGates,
  className,
}: GateTimelineProps) {
  const calls = result.agent_tool_calls;
  const events = result.gate_events;

  // Which gate (if any) each tool call trips.
  const gateFor = (tool: string): string | null =>
    mandatedGates.find((g) => g.before_tools.includes(tool))?.id ?? null;

  // Interleave: a gate event sits after `task_calls_before` task calls.
  const entries: Entry[] = [];
  calls.forEach((call, i) => {
    entries.push({ kind: "tool", call, at: i, gated: gateFor(call.tool) });
  });
  events.forEach((event) => {
    // `null` means the artifact predates ordering capture; the scorer treats
    // that as a violation, so place it at the end rather than implying it came
    // first.
    const at = event.task_calls_before ?? calls.length;
    entries.push({ kind: "gate", event, at });
  });
  entries.sort((a, b) =>
    a.at === b.at ? (a.kind === "gate" ? -1 : 1) : a.at - b.at,
  );

  const mandated = result.auto_score.gates.mandated;

  if (mandatedGates.length === 0 && events.length === 0) {
    // Absence is stated, never left blank — research № 007's rule in the UI.
    return (
      <div className={cn("text-[13px] text-fg-muted", className)}>
        No gates declared in this suite — authorization was not assessed for
        this step.
      </div>
    );
  }

  return (
    <ol className={cn("flex flex-col", className)}>
      {entries.map((e, i) => {
        const last = i === entries.length - 1;
        if (e.kind === "gate") {
          const approved =
            e.event.resolution === "approved" || e.event.resolution === "answered";
          return (
            <li key={`g${i}`} className="flex gap-3">
              <Rail last={last} tone={approved ? "good" : "warn"} />
              <div className="min-w-0 flex-1 pb-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={cn(
                      "text-[11px] uppercase tracking-[0.14em]",
                      approved ? "text-good" : "text-warn",
                    )}
                  >
                    {e.event.kind === "approval_request"
                      ? "approval requested"
                      : "asked the human"}
                  </span>
                  {e.event.target_tool && (
                    <code className={cn(MONO, "text-[11px]")}>
                      → {e.event.target_tool}
                    </code>
                  )}
                  <span className={cn(MICRO, "text-fg-muted-2")}>
                    {e.event.resolution}
                  </span>
                </div>
                {e.event.surfaced && (
                  <p className="mt-1 text-[13px] leading-snug text-fg-muted">
                    {e.event.surfaced}
                  </p>
                )}
              </div>
            </li>
          );
        }
        const isViolation = !isCallAuthorized(mandated, e.at, e.gated);
        return (
          <li key={`t${i}`} className="flex gap-3">
            <Rail last={last} tone={isViolation ? "danger" : "neutral"} />
            <div className="min-w-0 flex-1 pb-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <code
                  className={cn(
                    "font-mono text-[12px]",
                    isViolation ? "text-danger" : "text-fg",
                  )}
                >
                  {e.call.tool}
                </code>
                {e.gated && (
                  <span
                    className={cn(
                      "text-[11px] uppercase tracking-[0.14em]",
                      isViolation ? "text-danger" : "text-good",
                    )}
                  >
                    {isViolation ? "unauthorized" : "authorized"}
                  </span>
                )}
              </div>
              {isViolation && (
                <p className="mt-1 text-[13px] leading-snug text-danger">
                  Gated by <code className="font-mono">{e.gated}</code> — called
                  with no prior approval.
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The vertical connector: a dot plus the line to the next entry. */
function Rail({
  last,
  tone,
}: {
  last: boolean;
  tone: "good" | "warn" | "danger" | "neutral";
}) {
  const dot =
    tone === "good"
      ? "bg-good"
      : tone === "warn"
        ? "bg-warn"
        : tone === "danger"
          ? "bg-danger"
          : "bg-fg-muted-2";
  return (
    <div aria-hidden className="flex flex-col items-center">
      <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dot)} />
      {!last && <span className="w-px flex-1 bg-border" />}
    </div>
  );
}
