import Link from "next/link";
import type { ReactNode } from "react";

const DOCS_NAV: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: "Get started",
    items: [
      { href: "/docs/quickstart", label: "Quickstart" },
      { href: "/docs/paradigm", label: "Why eval-kit exists" },
    ],
  },
  {
    group: "Build",
    items: [
      { href: "/docs/authoring", label: "Authoring tasks" },
      { href: "/docs/adapters", label: "Writing adapters" },
      { href: "/docs/cli", label: "CLI reference" },
    ],
  },
  {
    group: "Reference",
    items: [
      { href: "/docs/rubric", label: "Scoring rubric" },
      { href: "/docs/faq", label: "FAQ" },
    ],
  },
];

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[clamp(180px,15vw,240px)_minmax(0,1fr)] gap-0">
      <aside className="sticky top-11 h-[calc(100dvh-44px)] overflow-y-auto border-r border-border/70 bg-bg px-4 py-6">
        <div className="mb-5 text-2xs uppercase tracking-wider text-fg-muted-2">
          Docs
        </div>
        <nav className="space-y-5">
          {DOCS_NAV.map((group) => (
            <div key={group.group}>
              <div className="mb-2 text-[10px] uppercase tracking-wider text-fg-muted-2">
                {group.group}
              </div>
              <ul className="space-y-px">
                {group.items.map((i) => (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      className="block rounded-md px-2 py-1.5 text-[13px] text-fg-muted transition-colors hover:bg-bg-elev-2/60 hover:text-fg"
                    >
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <article className="prose-eval-kit mx-auto w-full max-w-[68ch] px-[clamp(1.25rem,3.5vw,3rem)] py-[clamp(2rem,3.5vw,3rem)]">
        {children}
      </article>
    </div>
  );
}
