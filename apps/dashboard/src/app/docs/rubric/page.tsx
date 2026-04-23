import type { Dimension } from "@eval-kit/core";
import {
  DIMENSION_DESCRIPTIONS,
  DIMENSION_LABELS,
  DIMENSION_ORDER,
  DIMENSION_RUBRIC_EXAMPLES,
} from "@eval-kit/core";
import { Code, Eyebrow, H1, H2, Lead, Li, P, Ul } from "@/components/Prose";

export default function Page() {
  return (
    <>
      <Eyebrow>Reference</Eyebrow>
      <H1>Scoring rubric</H1>
      <Lead>
        Two scales, both 0–3. The copy below is the single source of truth —
        the in-app <Code>DimensionExplainer</Code> popovers read from the same
        constants.
      </Lead>

      <H2 id="golden-truth">Golden truth rubric</H2>
      <P>
        Every step has a <Code>golden_truth</Code> — what the agent should
        produce. Score the agent&apos;s output against it:
      </P>
      <Ul>
        <Li>
          <strong>0 — fail.</strong> Did not attempt or completely wrong.
        </Li>
        <Li>
          <strong>1 — partial.</strong> Partial attempt, major gaps.
        </Li>
        <Li>
          <strong>2 — mostly.</strong> Mostly correct, minor gaps.
        </Li>
        <Li>
          <strong>3 — full.</strong> Fully hit the golden truth.
        </Li>
      </Ul>
      <P>
        The <Code>pass_rate</Code> metric counts steps with golden_truth ≥ 2.
      </P>

      <H2 id="dimensions">Five dimensions</H2>
      <P>
        Optional per-step dimensions. Score each 0–3. A task declares which
        dimensions are in scope via <Code>dimensions_in_scope</Code>; a step
        can override via <Code>scoring_hints.dimensions</Code>.
      </P>

      {DIMENSION_ORDER.map((dim) => (
        <DimensionSection key={dim} dimension={dim} />
      ))}

      <H2 id="tool-match">Tool match (auto-scored)</H2>
      <P>The runner auto-scores tool-match before any human ever sees the run:</P>
      <Ul>
        <Li>
          <Code>strict</Code> — the set of tools called must exactly equal the expected set.
        </Li>
        <Li>
          <Code>subset</Code> (default) — every expected tool must be called; extras are fine. Partial credit if at least one expected tool was called.
        </Li>
        <Li>
          <Code>any</Code> — at least one expected tool must be called.
        </Li>
      </Ul>

      <H2 id="distraction">Distraction detection (auto-scored)</H2>
      <P>
        For tasks marked <Code>is_distraction: true</Code>, the runner checks
        whether the agent hedged (matched heuristic phrases like &quot;can&apos;t
        verify&quot;, &quot;no sources found&quot;) OR called no tools at all.
        Humans can override in the review UI.
      </P>
    </>
  );
}

function DimensionSection({ dimension }: { dimension: Dimension }) {
  return (
    <>
      <H2 id={dimension}>{DIMENSION_LABELS[dimension]}</H2>
      <P>{DIMENSION_DESCRIPTIONS[dimension]}</P>
      <Ul>
        {([0, 1, 2, 3] as const).map((s) => (
          <Li key={s}>
            <strong>{s} —</strong> {DIMENSION_RUBRIC_EXAMPLES[dimension][s]}
          </Li>
        ))}
      </Ul>
    </>
  );
}
