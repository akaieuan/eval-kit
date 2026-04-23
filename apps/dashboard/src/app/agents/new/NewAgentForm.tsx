"use client";
import {
  Button,
  InlineHelp,
  Input,
  Textarea,
} from "@eval-kit/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAgentProfile } from "../actions";

const STARTER_BY_BACKEND: Record<string, string> = {
  anthropic: `agent:
  id: my-claude-agent
  name: My Claude agent
  description: What this agent is supposed to do.
  based_on: anthropic
  model: claude-sonnet-4-5
  system_prompt: |
    You are a helpful assistant.
    Explain your reasoning. Flag uncertainty.
  max_tool_iterations: 8
  tools:
    - name: web_search
      description: Search the web
      input_schema:
        type: object
        properties:
          query: { type: string }
        required: [query]
`,
  mock: `agent:
  id: mock-agent
  name: Mock agent
  based_on: mock
  model: mock-1
`,
  http: `agent:
  id: my-http-agent
  name: Internal HTTP agent
  based_on: http
  url: https://internal.example.com/agent
  model: v0
  headers:
    authorization: Bearer YOUR_TOKEN
`,
};

export function NewAgentForm() {
  const router = useRouter();
  const [backend, setBackend] = useState<"anthropic" | "mock" | "http">(
    "anthropic",
  );
  const [filename, setFilename] = useState("my-claude-agent.yaml");
  const [yaml, setYaml] = useState(STARTER_BY_BACKEND.anthropic!);
  const [pending, startTransition] = useTransition();

  const charCount = useMemo(() => yaml.length, [yaml]);

  function swapBackend(next: "anthropic" | "mock" | "http") {
    setBackend(next);
    setYaml(STARTER_BY_BACKEND[next] ?? STARTER_BY_BACKEND.anthropic!);
    const defaultName =
      next === "anthropic"
        ? "my-claude-agent.yaml"
        : next === "http"
          ? "my-http-agent.yaml"
          : "mock-agent.yaml";
    setFilename(defaultName);
  }

  function save() {
    startTransition(async () => {
      const res = await saveAgentProfile(filename, yaml);
      if (res.ok) {
        toast.success(`Saved ${res.id}`);
        router.push(`/agents/${res.id}`);
        router.refresh();
      } else {
        toast.error("Save failed", { description: res.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      <InlineHelp id="new-agent-intro" title="YAML — no TypeScript required">
        Describe your agent (backend, model, system prompt, tools). The YAML is
        validated against the AgentProfile schema before saving. Use
        <code> --agent agents/&lt;file&gt;.yaml </code> with any CLI command to run
        against it.
      </InlineHelp>

      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-2xs uppercase tracking-wider text-fg-muted-2">
            Backend
          </label>
          <div className="inline-flex items-center rounded-md border border-border bg-bg-elev">
            {(["anthropic", "mock", "http"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => swapBackend(b)}
                data-active={b === backend}
                className="px-3 py-1.5 text-[13px] text-fg-muted transition-colors data-[active=true]:bg-bg-elev-2 data-[active=true]:text-fg-strong hover:text-fg"
              >
                {b}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label
            htmlFor="filename"
            className="text-2xs uppercase tracking-wider text-fg-muted-2"
          >
            Filename
          </label>
          <Input
            id="filename"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label
            htmlFor="yaml"
            className="text-2xs uppercase tracking-wider text-fg-muted-2"
          >
            Profile YAML
          </label>
          <span className="text-2xs text-fg-muted-2">{charCount} chars</span>
        </div>
        <Textarea
          id="yaml"
          value={yaml}
          onChange={(e) => setYaml(e.target.value)}
          rows={22}
          className="font-mono text-[12.5px]"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            setYaml(STARTER_BY_BACKEND[backend] ?? STARTER_BY_BACKEND.anthropic!)
          }
        >
          Reset template
        </Button>
        <Button variant="primary" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save agent"}
        </Button>
      </div>
    </div>
  );
}
