import { Code, Eyebrow, H1, H2, Lead, Li, P, Pre, Ul } from "@/components/Prose";

export default function Page() {
  return (
    <>
      <Eyebrow>Build</Eyebrow>
      <H1>Writing adapters</H1>
      <Lead>
        An adapter is the bridge between eval-kit&apos;s runner and your agent.
        One interface, one method, zero abstractions you don&apos;t need.
      </Lead>

      <H2 id="interface">The interface</H2>
      <Pre>{`import type { AgentAdapter } from "@eval-kit/core/adapters";

export const myAgentAdapter: AgentAdapter = {
  name: "my-agent",
  model: "v0.1",
  config: {},
  async run({ prompt, context, expected_tools, prior_steps }) {
    // Call YOUR agent here.
    const resp = await myAgent.chat({
      prompt,
      context,
      tools: expected_tools,
      history: prior_steps,
    });

    return {
      tool_calls: resp.tool_calls.map(tc => ({
        tool: tc.name,
        args: tc.input,
        result: tc.output,
      })),
      final_output: resp.text,
      latency_ms: resp.elapsed_ms,
    };
  },
};`}</Pre>

      <H2 id="what-runner-gives-you">What the runner gives you</H2>
      <Ul>
        <Li>
          <Code>prompt</Code> — the current step&apos;s user turn.
        </Li>
        <Li>
          <Code>context</Code> — context items from the task (PDF refs, links).
        </Li>
        <Li>
          <Code>expected_tools</Code> — the tool names the suite expects. Your adapter decides how to surface these to the agent. For Anthropic, we map them into <Code>tools: [...]</Code>.
        </Li>
        <Li>
          <Code>prior_steps</Code> — previous step prompts + responses + tool calls, so your adapter can keep conversation history.
        </Li>
      </Ul>

      <H2 id="what-you-return">What you return</H2>
      <Ul>
        <Li>
          <Code>tool_calls</Code> — every tool the agent called during this step. Order matters; the runner uses this for auto-scoring tool-match.
        </Li>
        <Li>
          <Code>final_output</Code> — the agent&apos;s last text message.
        </Li>
        <Li>
          <Code>latency_ms</Code> — wall-clock time. For billing or latency-sensitive evals.
        </Li>
      </Ul>

      <H2 id="built-in">Built-in adapters</H2>
      <P>
        The <Code>mock</Code> adapter is a deterministic simulator — it honors <Code>expected_tools</Code> and returns a canned response per step. Useful for harness testing without live model costs.
      </P>
      <P>
        The <Code>anthropic</Code> adapter runs a real Claude tool-use loop. It maps <Code>expected_tools</Code> into Anthropic tool definitions, runs the agent loop until <Code>end_turn</Code> or <Code>maxToolIterations</Code>, and records every tool call. System prompt and tool defs use prompt caching, so iterating on the same suite is cheap.
      </P>

      <H2 id="custom-tool-results">Custom tool results</H2>
      <P>
        By default, the Anthropic adapter simulates tool results as <Code>{'{ ok: true, mock: true }'}</Code>. Override per-tool to return richer shapes so the agent can continue a tool chain:
      </P>
      <Pre>{`const adapter = createAnthropicAdapter({
  toolDefinitions: {
    academic_search: {
      description: "Search academic papers.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
      simulate: (args) => ({
        results: [
          { title: "On Superdeterminism", year: 2024, doi: "10.1234/fake" },
        ],
      }),
    },
  },
});`}</Pre>

      <H2 id="env">Environment variables</H2>
      <Ul>
        <Li>
          <Code>ANTHROPIC_API_KEY</Code> — required for the anthropic adapter.
        </Li>
        <Li>
          Your own adapter decides what env vars it needs. Read them inside the factory function, not at module load time, so tests can mock.
        </Li>
      </Ul>

      <H2 id="preflight">Preflight</H2>
      <P>
        Before a full suite run, dry-run the first task&apos;s first step to confirm wiring:
      </P>
      <Pre>{`eval-kit preflight suites/my-suite.yaml --adapter anthropic --model claude-sonnet-4-5`}</Pre>
    </>
  );
}
