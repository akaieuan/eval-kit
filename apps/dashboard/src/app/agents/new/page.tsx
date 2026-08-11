import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewAgentForm } from "./NewAgentForm";

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl space-y-7 px-[clamp(1.25rem,3.5vw,3.5rem)] py-7 pb-16">
      <div>
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-2xs text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={11} strokeWidth={1.5} /> All agents
        </Link>
        <h1 className="mt-3 text-[22px] font-light tracking-tight text-fg-strong">
          New agent
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-fg-muted">
          Define an agent by YAML — backend, model, system prompt, tools. The
          profile becomes the subject under test when you run a suite.
        </p>
      </div>
      <NewAgentForm />
    </div>
  );
}
