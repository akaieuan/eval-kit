import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, InlineHelp, Pill } from "@eval-kit/ui";
import { ArrowLeft } from "lucide-react";
import { loadAgentById, readAgentYaml } from "@/lib/agents";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await loadAgentById(id);
  if (!entry) notFound();
  const yaml = await readAgentYaml(entry.file);
  const a = entry.profile.agent;
  const tools = "tools" in a && Array.isArray(a.tools) ? a.tools : [];

  return (
    <div className="space-y-5 px-8 py-6">
      <div>
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-2xs text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={11} strokeWidth={1.5} /> All agents
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <code className="font-mono text-[15px] text-fg-strong">{a.id}</code>
          <Pill dot="info">{a.based_on}</Pill>
          {"model" in a && a.model && (
            <Badge variant="outline">{a.model}</Badge>
          )}
        </div>
        {"description" in a && a.description && (
          <p className="mt-2 max-w-2xl text-xs text-fg-muted leading-relaxed">
            {a.description}
          </p>
        )}
      </div>

      <InlineHelp id="agent-detail-run" title="Run a suite against this agent">
        From the CLI:
        <pre className="mt-2 rounded-md bg-bg-elev-2 px-2.5 py-2 font-mono text-2xs text-fg-muted">
          eval-kit run suites/&lt;suite&gt;.yaml --agent agents/{entry.file}
        </pre>
        Edit the YAML on disk to iterate on the system prompt or tools; the
        change picks up on the next run.
      </InlineHelp>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <aside className="space-y-3 rounded-lg border border-border/80 bg-bg-elev px-4 py-3 text-xs">
          <Row label="Backend" value={a.based_on} />
          {"model" in a && a.model && <Row label="Model" value={a.model} />}
          {"max_tool_iterations" in a && a.max_tool_iterations && (
            <Row
              label="Max tool iters"
              value={String(a.max_tool_iterations)}
            />
          )}
          {"api_key_env" in a && a.api_key_env && (
            <Row label="API key env" value={a.api_key_env} />
          )}
          {"url" in a && a.url && <Row label="URL" value={a.url} />}
          {tools.length > 0 && (
            <div>
              <div className="text-2xs uppercase tracking-wider text-fg-muted-2">
                Tools
              </div>
              <ul className="mt-1.5 space-y-1">
                {tools.map((t) => (
                  <li key={t.name} className="font-mono text-2xs text-fg">
                    {t.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
        <div className="overflow-hidden rounded-lg border border-border/80 bg-bg-elev">
          <div className="flex items-center justify-between border-b border-border/70 bg-bg-elev-2/40 px-3 py-2">
            <code className="font-mono text-2xs text-fg-muted-2">
              {entry.file}
            </code>
          </div>
          <pre className="max-h-[70vh] overflow-auto p-4 text-xs leading-relaxed text-fg-muted">
            {yaml}
          </pre>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-2xs uppercase tracking-wider text-fg-muted-2">
        {label}
      </span>
      <span className="truncate font-mono text-xs text-fg">{value}</span>
    </div>
  );
}
