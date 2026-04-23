import { Eyebrow, H1, H2, Lead, P, Ul, Li } from "@/components/Prose";

export default function Page() {
  return (
    <>
      <Eyebrow>Why eval-kit exists</Eyebrow>
      <H1>The Assist-Not-Complete paradigm</H1>
      <Lead>
        Existing agent evals (MMLU, SWE-bench, GAIA, AgentBench) measure
        autonomous task completion on synthetic tasks. They don&apos;t answer the
        question that actually matters: <em>when a real person uses this agent for real work, does it help or hurt?</em>
      </Lead>
      <P>
        The claim behind eval-kit: 95% of enterprise AI failure stems from
        benchmarks measuring the wrong thing. Scores go up while users quietly
        abandon the product. The gap is not capability — it&apos;s collaborative
        performance on real workflows, and nobody measures it.
      </P>

      <H2 id="five-dimensions">Five dimensions worth measuring</H2>
      <Ul>
        <Li>
          <strong>Explainability</strong> — did the agent explain what it did and why?
        </Li>
        <Li>
          <strong>Agency preservation</strong> — did the human retain control, or was it steamrolled?
        </Li>
        <Li>
          <strong>Long-term capability</strong> — does repeated use build or erode the user&apos;s skill?
        </Li>
        <Li>
          <strong>Calibration</strong> — does the agent know what it knows vs. what it&apos;s guessing?
        </Li>
        <Li>
          <strong>Collaborative performance</strong> — does the agent advance the real goal, including catching distractions?
        </Li>
      </Ul>

      <H2 id="humans-score">Humans score, not LLMs</H2>
      <P>
        LLM-as-judge scoring is unreliable on exactly the dimensions this
        framework cares about. An LLM can&apos;t tell you whether your agent
        steamrolled your agency — it was in on the steamrolling. A human can.
      </P>
      <P>
        eval-kit is built around the premise that a usable human-scoring UI is
        the missing primitive. It&apos;s also the hardest thing to build, which is
        why it hasn&apos;t been. If LLM-judge creeps in as the default, the project
        loses its reason to exist.
      </P>

      <H2 id="real-not-synthetic">Real tasks, not synthetic</H2>
      <P>
        Every task in the seed suite is ported from observed real usage. When
        adding tasks, prefer porting real workflows over fabricating
        plausible-looking ones. The <strong>AI-assist transcript extractor</strong> exists
        specifically to lower the friction of converting real sessions into
        evals — it drafts, the human finalizes.
      </P>

      <H2 id="multi-step">Multi-step, not single-turn</H2>
      <P>
        The value of eval-kit is in step-by-step tool selection and golden-truth
        checks. A single-turn variant is easier but misses the point: most real
        research flows require the agent to make choices across 3–9 turns, and
        the interesting failures live at the seams.
      </P>

      <H2 id="agent-agnostic">Agent-agnostic</H2>
      <P>
        The seed comes from observing a specific research agent, but the
        schema fits any research agent. Scrub product-specific names. The
        framework doesn&apos;t care which company&apos;s agent you run.
      </P>

      <H2 id="no-leaderboards">No benchmark marketing</H2>
      <P>
        Aggregate scores are informative internally but not suitable for
        leaderboards — that&apos;s the whole argument. Don&apos;t claim &quot;eval-kit
        scores higher than X.&quot; eval-kit measures qualitative collaborative
        performance, and the comparison that matters is &quot;your agent vs. your
        agent last month,&quot; not &quot;your agent vs. someone else&apos;s.&quot;
      </P>
    </>
  );
}
