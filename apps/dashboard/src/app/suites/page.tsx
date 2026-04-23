import Link from "next/link";
import { Badge, Button, InlineHelp } from "@eval-kit/ui";
import { FileCode, Plus } from "lucide-react";
import { listSuiteFiles } from "@/lib/suites";

export default async function Page() {
  const suites = await listSuiteFiles();

  return (
    <div className="space-y-5 px-[clamp(1.25rem,3.5vw,3.5rem)] py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-light tracking-tight text-fg-strong">
            Suites
          </h1>
          <p className="mt-1 text-xs text-fg-muted">
            YAML files under <code>packages/seed-suite/suites/</code>.
          </p>
        </div>
        <Button asChild variant="primary">
          <Link href="/suites/new">
            <Plus size={13} strokeWidth={1.5} /> New suite
          </Link>
        </Button>
      </div>

      <InlineHelp id="suites-primer" title="Three ways to author a suite">
        Write YAML by hand, copy from a seed task, or paste a real agent-user
        transcript and let Claude draft it. Whatever you land with, the schema
        is validated live.
      </InlineHelp>

      {suites.length === 0 ? (
        <p className="text-xs text-fg-muted">No suites yet.</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3">
          {suites.map((entry) => (
            <li
              key={entry.file}
              className="rounded-lg border border-border/80 bg-bg-elev px-5 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileCode
                      size={13}
                      strokeWidth={1.5}
                      className="text-fg-muted-2"
                    />
                    <code className="font-mono text-xs text-fg-strong">
                      {entry.suite.suite.id}
                    </code>
                    <Badge variant="outline">
                      v{entry.suite.suite.version}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-fg-muted leading-relaxed">
                    {entry.suite.suite.description}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-2xs text-fg-muted-2">
                    <span>{entry.suite.suite.tasks.length} tasks</span>
                    <span>
                      Targets {entry.suite.suite.target_agent_type}
                    </span>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/suites/${entry.suite.suite.id}`}>Open</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
