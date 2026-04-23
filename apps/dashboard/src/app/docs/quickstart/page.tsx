import { InlineHelp } from "@eval-kit/ui";
import { Code, Eyebrow, H1, H2, Lead, Ol, Li, P, Pre } from "@/components/Prose";

export default function Page() {
  return (
    <>
      <Eyebrow>Get started</Eyebrow>
      <H1>Quickstart</H1>
      <Lead>
        Five steps from zero to a scored eval run. This is the 60-second tour —
        for the why, read the <a href="/docs/paradigm" className="text-accent underline">paradigm essay</a>.
      </Lead>

      <H2 id="install">1. Install</H2>
      <P>eval-kit is a monorepo. Clone it and install once:</P>
      <Pre>{`git clone https://github.com/akaieuan/eval-kit
cd eval-kit
pnpm install
pnpm -r build`}</Pre>

      <H2 id="authoring">2. Author a suite</H2>
      <P>
        A suite is a YAML file describing multi-step research tasks. You get three paths:
      </P>
      <Ol>
        <Li>
          Hand-write YAML. See the <Code>packages/seed-suite/suites/research-agent-v1.yaml</Code> file for a reference.
        </Li>
        <Li>
          <a href="/suites/new" className="text-accent underline">Use the in-app &quot;New suite&quot; flow</a> — Blank template or copy from seed.
        </Li>
        <Li>
          <strong>AI-assist</strong> — paste a real agent-user transcript, Claude drafts a task for you.{" "}
          <a href="/docs/authoring#transcript" className="text-accent underline">Walkthrough →</a>
        </Li>
      </Ol>

      <H2 id="run">3. Run against your agent</H2>
      <P>
        Out of the box, eval-kit ships two adapters: <Code>mock</Code> (deterministic) and <Code>anthropic</Code> (real Claude, tool-use loop). Try the mock first:
      </P>
      <Pre>{`node packages/core/dist/cli.js run \\
  packages/seed-suite/suites/research-agent-v1.yaml \\
  --adapter mock \\
  --out runs/demo.json`}</Pre>

      <InlineHelp id="env" title="Using the Anthropic adapter">
        Set <Code>ANTHROPIC_API_KEY</Code> in <Code>.env.local</Code> at the repo root, then swap <Code>--adapter mock</Code> for <Code>--adapter anthropic</Code>.
      </InlineHelp>

      <H2 id="score">4. Score the run</H2>
      <P>
        Start the dashboard and open your run. Score each step with the keyboard (<Code>1</Code>–<Code>3</Code> for golden truth, <Code>j</Code>/<Code>k</Code> between steps). Scores autosave.
      </P>
      <Pre>{`pnpm --filter @eval-kit/dashboard dev
# open http://localhost:3000`}</Pre>

      <H2 id="diff">5. Diff versions</H2>
      <P>
        Once you have at least two scored runs (a baseline and a new one), the <a href="/diff" className="text-accent underline">Diff page</a> flags regressions and improvements step-by-step.
      </P>

      <H2 id="next">What&apos;s next?</H2>
      <Ol>
        <Li>
          Write your first real adapter — see <a href="/docs/adapters" className="text-accent underline">Writing adapters</a>.
        </Li>
        <Li>
          Read the <a href="/docs/rubric" className="text-accent underline">scoring rubric</a> so your grades are consistent across runs.
        </Li>
        <Li>
          Start a project of your own: <Pre>npx @eval-kit/core init my-evals</Pre>
        </Li>
      </Ol>
    </>
  );
}
