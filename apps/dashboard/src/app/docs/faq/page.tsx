import { Eyebrow, H1, H2, Lead, P } from "@/components/Prose";

export default function Page() {
  return (
    <>
      <Eyebrow>Reference</Eyebrow>
      <H1>FAQ</H1>
      <Lead>
        Common questions people ask when they first encounter eval-kit.
      </Lead>

      <H2 id="llm-judge">Why not use LLM-as-judge scoring?</H2>
      <P>
        LLM-as-judge is unreliable on exactly the dimensions this framework cares about — agency preservation, calibration, collaborative performance. The judge was trained on the same objectives as the agent and shares the same blind spots. A human reviewer catches the things the judge rationalizes.
      </P>
      <P>
        In a later version we&apos;ll support optional LLM pre-fill tracked as <code>pre_filled: true</code>, so a human can accept/override for calibration studies. But the default will always be human scoring.
      </P>

      <H2 id="many-reviewers">How many reviewers do I need?</H2>
      <P>
        For v0.2, one reviewer (you). The <code>EVAL_KIT_REVIEWER</code> env var writes into every saved score so you can diff across reviewers later. Multi-reviewer + inter-rater agreement lands in v0.3.
      </P>

      <H2 id="coding-agents">Can I use this for coding agents?</H2>
      <P>
        Technically yes — the schema is agent-agnostic. But the seed suite and tool-match heuristics are tuned for research agents (PDF reading, search, notes, canvas). Coding-agent evals have different failure modes (test coverage, diff correctness) that warrant their own scoring extensions. v0.3 or later.
      </P>

      <H2 id="without-dashboard">Do I need the dashboard?</H2>
      <P>
        No — the CLI is sufficient to run + diff + report. The dashboard is the <em>scoring cockpit</em>: if you&apos;re not scoring by hand, the CLI covers everything. You can generate scored runs programmatically too if your use case allows (e.g. committing to a ground-truth comparison via code).
      </P>

      <H2 id="production">Is this production-ready?</H2>
      <P>
        It&apos;s v0.2 — file-based storage, single-user, experimental. It&apos;s designed for use inside research teams, not as a hosted service. If you need multi-tenant hosted evals, eval-kit is not that; fork it and build what you need.
      </P>

      <H2 id="compared-to">How does this compare to LangSmith / Braintrust / PromptFoo?</H2>
      <P>
        Those tools do what they do well — automated regression testing, LLM-judge pipelines, prompt iteration. eval-kit intentionally doesn&apos;t compete with them. It measures a different thing: collaborative performance on real human workflows, scored by the human. If you want automated fast-feedback testing, use the others. If you want to know whether your agent actually helps your users, use eval-kit too.
      </P>

      <H2 id="contributing">Can I contribute?</H2>
      <P>
        Yes — see <a href="https://github.com/akaieuan/eval-kit/blob/main/CONTRIBUTING.md" className="text-accent underline">CONTRIBUTING.md</a>. Best contributions: real research workflows ported into the seed suite, adapters for new agent SDKs, and sharper inline docs.
      </P>
    </>
  );
}
