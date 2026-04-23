"use client";
import { Button, InlineHelp, Textarea } from "@eval-kit/ui";
import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { draftTaskFromTranscript } from "./actions";

export interface FromTranscriptProps {
  keyAvailable: boolean;
  onDraftReady: (yaml: string, taskId: string) => void;
}

export function FromTranscript({
  keyAvailable,
  onDraftReady,
}: FromTranscriptProps) {
  const [transcript, setTranscript] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function extract() {
    setError(null);
    startTransition(async () => {
      const res = await draftTaskFromTranscript(transcript);
      if (res.ok) {
        onDraftReady(res.yaml, res.taskId);
        toast.success(`Drafted ${res.taskId}`, {
          description: "Review + edit before saving.",
        });
      } else {
        setError(res.error);
        toast.error("Could not draft", { description: res.error });
      }
    });
  }

  if (!keyAvailable) {
    return (
      <InlineHelp
        id="no-anthropic-key"
        variant="warn"
        title="ANTHROPIC_API_KEY not set"
        dismissible={false}
      >
        AI-assisted authoring uses Claude. Add the key to your environment:
        <pre className="mt-2 rounded bg-bg-elev-2 px-2.5 py-1.5 font-mono text-2xs">
          # .env.local at repo root{"\n"}
          ANTHROPIC_API_KEY=sk-ant-...
        </pre>
        Reload this page once the var is set.
      </InlineHelp>
    );
  }

  return (
    <div className="space-y-3">
      <InlineHelp id="transcript-guide" title="Paste a real agent session">
        Include both sides — the user turns and the agent responses (tool calls
        noted inline are fine). Claude drafts a YAML <code>EvalTask</code>,
        then you edit it before saving. The human always finalizes.
      </InlineHelp>

      <Textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder={`USER: Can you find counter-positioned papers on cosmological superdeterminism?
AGENT: [calls academic_search] Here are 3 papers that argue...
USER: Take notes on the first one.
AGENT: ...`}
        rows={14}
        className="font-mono text-xs"
      />

      {error && (
        <div className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-2xs text-fg-muted-2">
          {transcript.length} chars
        </div>
        <Button
          variant="primary"
          disabled={pending || transcript.trim().length < 30}
          onClick={extract}
        >
          <Sparkles size={14} />
          {pending ? "Drafting…" : "Extract draft"}
        </Button>
      </div>
    </div>
  );
}
