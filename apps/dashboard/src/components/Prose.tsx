import type { ReactNode } from "react";

export function H1({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-[28px] font-light tracking-tight text-fg-strong">
      {children}
    </h1>
  );
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mt-12 border-t border-border/60 pt-7 text-[18px] font-normal tracking-tight text-fg-strong"
    >
      {children}
    </h2>
  );
}

export function H3({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3
      id={id}
      className="mt-7 text-[14px] font-normal tracking-tight text-fg-strong"
    >
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-[14px] leading-relaxed text-fg-muted">
      {children}
    </p>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-[16px] font-light leading-relaxed text-fg">
      {children}
    </p>
  );
}

export function Ul({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-5 text-[14px] text-fg-muted marker:text-fg-muted-2">
      {children}
    </ul>
  );
}

export function Ol({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-4 list-decimal space-y-2 pl-5 text-[14px] text-fg-muted marker:text-fg-muted-2">
      {children}
    </ol>
  );
}

export function Li({ children }: { children: ReactNode }) {
  return <li className="leading-relaxed">{children}</li>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-border/60 bg-bg-elev-2/60 px-1.5 py-0.5 font-mono text-[11.5px] text-fg">
      {children}
    </code>
  );
}

export function Pre({ children }: { children: ReactNode }) {
  return (
    <pre className="mt-5 overflow-auto rounded-lg border border-border/70 bg-bg-elev px-4 py-3 font-mono text-xs leading-relaxed text-fg-muted">
      {children}
    </pre>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-2xs uppercase tracking-wider text-fg-muted-2">
      {children}
    </div>
  );
}
