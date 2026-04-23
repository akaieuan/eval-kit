import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { hasAnthropicKey } from "@/lib/env";
import { NewSuiteTabs } from "./NewSuiteTabs";

export default async function Page() {
  const keyAvailable = hasAnthropicKey();

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-[clamp(1.25rem,3.5vw,3.5rem)] py-6">
      <div>
        <Link
          href="/suites"
          className="inline-flex items-center gap-1.5 text-2xs text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={11} strokeWidth={1.5} /> All suites
        </Link>
        <h1 className="mt-3 text-[18px] font-light tracking-tight text-fg-strong">
          New suite
        </h1>
        <p className="mt-1 text-xs text-fg-muted">
          Three paths: hand-write YAML, copy from the seed, or paste a real
          transcript and let Claude draft a task for you.
        </p>
      </div>
      <NewSuiteTabs keyAvailable={keyAvailable} />
    </div>
  );
}
