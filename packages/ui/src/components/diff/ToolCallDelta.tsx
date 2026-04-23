import { cn } from "../../lib/cn.js";

export interface ToolCallDeltaProps {
  a: string[];
  b: string[];
  className?: string;
}

export function ToolCallDelta({ a, b, className }: ToolCallDeltaProps) {
  const setA = new Set(a);
  const setB = new Set(b);
  const both = [...setA].filter((t) => setB.has(t));
  const onlyA = [...setA].filter((t) => !setB.has(t));
  const onlyB = [...setB].filter((t) => !setA.has(t));

  if (both.length + onlyA.length + onlyB.length === 0) {
    return (
      <div className={cn("text-2xs text-fg-muted-2", className)}>
        no tool calls
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1 text-2xs", className)}>
      {both.map((t) => (
        <span
          key={`same-${t}`}
          className="rounded bg-bg-elev-2 px-1.5 py-0.5 font-mono text-fg-muted"
        >
          {t}
        </span>
      ))}
      {onlyA.map((t) => (
        <span
          key={`a-${t}`}
          className="rounded bg-danger/10 px-1.5 py-0.5 font-mono text-danger"
          title="removed in B"
        >
          −{t}
        </span>
      ))}
      {onlyB.map((t) => (
        <span
          key={`b-${t}`}
          className="rounded bg-good/10 px-1.5 py-0.5 font-mono text-good"
          title="added in B"
        >
          +{t}
        </span>
      ))}
    </div>
  );
}
