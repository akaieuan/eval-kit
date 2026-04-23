import Link from "next/link";
import { Badge, Button, InlineHelp, Pill } from "@eval-kit/ui";
import { Bot, Cloud, Globe, Plus, Sparkles } from "lucide-react";
import { listAgents } from "@/lib/agents";

const BACKEND_ICON = {
  anthropic: Cloud,
  openai: Sparkles,
  http: Globe,
  mock: Bot,
} as const;

export default async function Page() {
  const agents = await listAgents();

  return (
    <div className="space-y-5 px-8 py-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[18px] font-light tracking-tight text-fg-strong">
            Agents
          </h1>
          <p className="mt-1 text-xs text-fg-muted">
            YAML-defined agent profiles. No code required.
          </p>
        </div>
        <Button asChild variant="primary">
          <Link href="/agents/new">
            <Plus size={12} strokeWidth={1.5} /> New agent
          </Link>
        </Button>
      </div>

      <InlineHelp id="agents-primer" title="Run a suite against an agent profile">
        Each profile is a YAML file under <code>agents/</code>. From the CLI:
        <pre className="mt-2 rounded-md bg-bg-elev-2 px-2.5 py-2 font-mono text-2xs text-fg-muted">
          eval-kit run suites/my-suite.yaml --agent agents/claude-research-v1.yaml
        </pre>
        Profiles capture model, system prompt, tools, and max tool iterations.
        Humans still score; the profile only defines the subject under test.
      </InlineHelp>

      {agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-8 py-12 text-center">
          <div className="text-[13px] text-fg-strong">No agents yet</div>
          <p className="mt-1 text-xs text-fg-muted">
            Create one with the button above, or copy from{" "}
            <code>agents/claude-research-v1.yaml</code> in the repo.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {agents.map(({ profile, file }) => {
            const a = profile.agent;
            const Icon = BACKEND_ICON[a.based_on];
            const toolCount =
              "tools" in a && Array.isArray(a.tools) ? a.tools.length : 0;
            return (
              <li
                key={a.id}
                className="flex flex-col rounded-lg border border-border/80 bg-bg-elev px-5 py-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border/70 text-fg-muted">
                      <Icon size={13} strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <code className="font-mono text-[13px] text-fg-strong">
                        {a.id}
                      </code>
                      {a.name !== a.id && (
                        <div className="truncate text-xs text-fg-muted">
                          {a.name}
                        </div>
                      )}
                    </div>
                  </div>
                  <Pill dot="info">{a.based_on}</Pill>
                </div>
                {"description" in a && a.description && (
                  <p className="mt-3 text-xs text-fg-muted leading-relaxed">
                    {a.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-2xs text-fg-muted-2">
                  {"model" in a && a.model && (
                    <Badge variant="outline">{a.model}</Badge>
                  )}
                  {toolCount > 0 && (
                    <span>
                      {toolCount} tool{toolCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {"max_tool_iterations" in a && a.max_tool_iterations && (
                    <span>max {a.max_tool_iterations} iters</span>
                  )}
                  <span className="font-mono">{file}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/agents/${a.id}`}>View</Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
