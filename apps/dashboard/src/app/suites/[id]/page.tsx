import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, InlineHelp } from "@eval-kit/ui";
import { ArrowLeft } from "lucide-react";
import { listSuiteFiles, loadSuiteYaml } from "@/lib/suites";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const suites = await listSuiteFiles();
  const entry = suites.find((s) => s.suite.suite.id === id);
  if (!entry) notFound();
  const yaml = await loadSuiteYaml(entry.file);

  const suite = entry.suite.suite;

  return (
    <div className="space-y-5 px-[clamp(1.25rem,3.5vw,3.5rem)] py-6">
      <div>
        <Link
          href="/suites"
          className="inline-flex items-center gap-1.5 text-2xs text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={11} strokeWidth={1.5} /> All suites
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <code className="font-mono text-[14px] text-fg-strong">
                {suite.id}
              </code>
              <Badge variant="outline">v{suite.version}</Badge>
            </div>
            <p className="mt-1.5 text-xs text-fg-muted">{suite.description}</p>
          </div>
        </div>
      </div>

      <InlineHelp id="suite-detail" title="This is a read-only view for now">
        Inline editing with monaco + live Zod diagnostics lands in v0.3. For
        now, edit the YAML on disk with your editor — the dashboard hot-reloads
        as soon as you save.
      </InlineHelp>

      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        <aside className="space-y-4 rounded-lg border border-border/80 bg-bg-elev px-5 py-4 text-xs">
          <div>
            <div className="text-2xs uppercase tracking-wider text-fg-muted-2">
              Target
            </div>
            <div className="mt-1 text-fg">{suite.target_agent_type}</div>
          </div>
          <div>
            <div className="text-2xs uppercase tracking-wider text-fg-muted-2">
              Dimensions in scope
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {suite.dimensions_in_scope.map((d) => (
                <Badge key={d} variant="accent">
                  {d}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="text-2xs uppercase tracking-wider text-fg-muted-2">
              Tasks
            </div>
            <ul className="mt-1.5 space-y-1">
              {suite.tasks.map((t) => (
                <li key={t.id} className="text-fg-muted">
                  <code className="font-mono text-2xs">{t.id}</code>
                  <span className="ml-1.5 text-fg-muted-2">
                    {t.steps.length} step{t.steps.length === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <div className="overflow-hidden rounded-lg border border-border/80 bg-bg-elev">
          <div className="flex items-center justify-between border-b border-border/70 bg-bg-elev-2/40 px-4 py-2">
            <code className="font-mono text-2xs text-fg-muted-2">
              {entry.file}
            </code>
          </div>
          <pre className="max-h-[70vh] overflow-auto px-4 py-3 text-xs leading-relaxed text-fg-muted">
            {yaml}
          </pre>
        </div>
      </div>
    </div>
  );
}
