import { InlineHelp } from "@eval-kit/ui";
import { Code, Eyebrow, H1, H2, Lead, Li, Ol, P, Pre, Ul } from "@/components/Prose";

export default function Page() {
  return (
    <>
      <Eyebrow>Build</Eyebrow>
      <H1>Authoring tasks</H1>
      <Lead>
        A task is a multi-step flow with a goal, context, prompts, expected
        tools, and a golden truth per step. Three ways to get one.
      </Lead>

      <H2 id="anatomy">Anatomy of a task</H2>
      <P>
        Every task lives inside a suite YAML. The schema (simplified):
      </P>
      <Pre>{`tasks:
  - id: task-001
    initial_purpose: Short one-liner on user intent
    overall_goal: What success looks like
    is_distraction: false
    context_items:
      - type: pdf
        label: Source paper
        ref: "@source:paper.pdf"
    steps:
      - n: 1
        prompt: The user turn
        expected_tools: [read_pdf]
        golden_truth: What the agent should produce
        scoring_hints:
          tool_match: subset       # strict | subset | any
          golden_truth_rubric: 0-3
          dimensions: [calibration, explainability]`}</Pre>

      <H2 id="blank">Path 1 — blank template</H2>
      <P>
        Open <a href="/suites/new" className="text-accent underline">New suite</a>, switch to the <strong>Blank template</strong> tab, edit YAML, save.
        Best when the task is small and tight.
      </P>

      <H2 id="seed">Path 2 — copy from seed</H2>
      <P>
        The seed suite at <Code>packages/seed-suite/suites/research-agent-v1.yaml</Code> has ported real research workflows (paper skimming, counter-argument search, grammar audit, future-dated distraction, cover letter, quote finding, weather). Copy the closest one and tweak.
      </P>

      <H2 id="transcript">Path 3 — from a transcript (AI-assist)</H2>
      <P>
        This is the differentiator. Paste a real agent-user transcript into the <strong>From transcript</strong> tab on the New suite page. Claude drafts a YAML EvalTask; you edit it before saving.
      </P>

      <InlineHelp id="transcript-guardrail" title="The human always finalizes">
        Transcript extraction is <em>drafting</em>, not scoring. Review every
        step. Expect <Code>[UNCERTAIN]</Code> markers in fields where the model
        wasn&apos;t confident — fill them with your own expectation before saving.
      </InlineHelp>

      <H2 id="guardrails">What makes a good task</H2>
      <Ul>
        <Li>
          <strong>Multi-step.</strong> Single-turn tasks miss most of the interesting failures — pick flows with 2–5 turns.
        </Li>
        <Li>
          <strong>Real, not synthetic.</strong> Observed user workflows beat plausible-looking ones. Port from your own usage if possible.
        </Li>
        <Li>
          <strong>Golden truth is concrete.</strong> &quot;Produces a good summary&quot; is too vague. &quot;Names the author + date and produces 10 notes grounded in the paper&quot; is scorable.
        </Li>
        <Li>
          <strong>Expected tools reflect intent.</strong> List tools the agent <em>should</em> use for this task, not everything it <em>could</em>.
        </Li>
        <Li>
          <strong>Distractions belong in the suite.</strong> Add at least one impossible/unverifiable task to test calibration.
        </Li>
      </Ul>

      <H2 id="validation">Validation</H2>
      <P>
        Every suite is validated against the Zod schema in <Code>@eval-kit/core/schema</Code> when loaded. A bad suite fails loudly at <Code>eval-kit run</Code> before wasting any agent tokens.
      </P>

      <H2 id="iteration">Iterating on a suite</H2>
      <Ol>
        <Li>Draft a task, run against mock adapter — confirm structure.</Li>
        <Li>Run against your real adapter — observe where it fails.</Li>
        <Li>Score the run, note failure modes in <Code>notes_on_observed_runs</Code>.</Li>
        <Li>Refine <Code>expected_tools</Code> / <Code>golden_truth</Code> based on what you learned.</Li>
      </Ol>
    </>
  );
}
