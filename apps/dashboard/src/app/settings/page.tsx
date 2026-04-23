import { InlineHelp, Pill } from "@eval-kit/ui";
import { hasAnthropicKey, reviewerIdentity } from "@/lib/env";

export default async function Page() {
  const keySet = hasAnthropicKey();
  const reviewer = reviewerIdentity();

  return (
    <div className="space-y-5 px-[clamp(1.25rem,3.5vw,3.5rem)] py-6">
      <div>
        <h1 className="text-[18px] font-light tracking-tight text-fg-strong">
          Settings
        </h1>
        <p className="mt-1 text-xs text-fg-muted">
          Environment status. Multi-user auth is v0.3.
        </p>
      </div>

      <InlineHelp id="settings-env" title="Settings are env-driven in v0.2">
        The dashboard is single-user and single-machine. Environment variables
        are the only knobs. Set them in <code>.env.local</code> at the repo
        root or export them in your shell.
      </InlineHelp>

      <div className="divide-y divide-border/60 rounded-lg border border-border/80 bg-bg-elev px-5 text-xs">
        <Row
          label="ANTHROPIC_API_KEY"
          value={keySet ? "set" : "not set"}
          tone={keySet ? "good" : "warn"}
          hint={
            keySet
              ? "Anthropic adapter + AI-assist authoring are enabled."
              : "Set this to use the Anthropic adapter or draft tasks from transcripts."
          }
        />
        <Row
          label="EVAL_KIT_REVIEWER"
          value={reviewer}
          tone="muted"
          hint="Identifier written into every saved score. Defaults to 'local'."
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "muted";
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="font-mono text-xs text-fg">{label}</div>
        <div className="mt-1 text-2xs text-fg-muted leading-relaxed">
          {hint}
        </div>
      </div>
      <Pill dot={tone}>{value}</Pill>
    </div>
  );
}
