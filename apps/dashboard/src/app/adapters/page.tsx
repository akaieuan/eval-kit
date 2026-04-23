import { Badge, InlineHelp, Pill } from "@eval-kit/ui";
import { Bot, Cloud, Globe, Sparkles } from "lucide-react";
import { hasAnthropicKey } from "@/lib/env";

export default async function Page() {
  const keySet = hasAnthropicKey();

  const adapters = [
    {
      id: "mock",
      name: "mock",
      description:
        "Deterministic simulator. Returns a canned response per step, honoring expected_tools. Use it to test the harness without hitting a live model.",
      ready: true,
      icon: Bot,
      requirement: "none",
      builtin: true,
    },
    {
      id: "anthropic",
      name: "anthropic",
      description:
        "Real Claude adapter with tool-use loop and prompt caching. Maps expected_tools → Anthropic tool schemas, runs the agent loop until end_turn or maxToolIterations.",
      ready: keySet,
      icon: Cloud,
      requirement: "ANTHROPIC_API_KEY env var",
      builtin: true,
    },
    {
      id: "openai",
      name: "openai",
      description:
        "OpenAI adapter. Bring your own `openai` SDK client; eval-kit wires expected_tools → function-calling and records the tool-call trace. Consumer installs the SDK to keep eval-kit lean.",
      ready: false,
      icon: Sparkles,
      requirement: "openai npm package + OPENAI_API_KEY",
      builtin: true,
    },
    {
      id: "http",
      name: "http",
      description:
        "Generic HTTP adapter. Point at any POST endpoint that runs your agent — internal services, OpenAI-compatible gateways, local runtimes. Optional requestBody/parseResponse for custom shapes.",
      ready: true,
      icon: Globe,
      requirement: "a reachable URL",
      builtin: true,
    },
  ];

  return (
    <div className="space-y-5 px-[clamp(1.25rem,3.5vw,3.5rem)] py-6">
      <div>
        <h1 className="text-[18px] font-light tracking-tight text-fg-strong">
          Adapters
        </h1>
        <p className="mt-1 text-xs text-fg-muted">
          Bridges between eval-kit&apos;s runner and your agent of choice.
        </p>
      </div>

      <InlineHelp id="adapters-intro" title="Want to wire your own agent?">
        Implement the <code>AgentAdapter</code> interface — one async{" "}
        <code>run()</code> method that returns <code>tool_calls</code>,{" "}
        <code>final_output</code>, and <code>latency_ms</code>. See{" "}
        <a href="/docs/adapters" className="text-accent underline underline-offset-2">
          the adapters guide
        </a>
        .
      </InlineHelp>

      <ul className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3">
        {adapters.map((a) => {
          const Icon = a.icon;
          return (
            <li
              key={a.id}
              className="rounded-lg border border-border/80 bg-bg-elev px-5 py-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border/70 text-fg-muted">
                    <Icon size={13} strokeWidth={1.5} />
                  </div>
                  <code className="font-mono text-[13px] text-fg-strong">
                    {a.name}
                  </code>
                </div>
                {a.ready ? (
                  <Pill dot="good">ready</Pill>
                ) : (
                  <Pill dot="warn">needs setup</Pill>
                )}
              </div>
              <p className="mt-3 text-xs text-fg-muted leading-relaxed">
                {a.description}
              </p>
              <div className="mt-3 flex items-center gap-2 text-2xs text-fg-muted-2">
                <span>Requires</span>
                <Badge variant={a.ready ? "good" : "warn"}>
                  {a.requirement}
                </Badge>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
