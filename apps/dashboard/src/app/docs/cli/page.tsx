import { Code, Eyebrow, H1, H2, Lead, P, Pre } from "@/components/Prose";

export default function Page() {
  return (
    <>
      <Eyebrow>Build</Eyebrow>
      <H1>CLI reference</H1>
      <Lead>
        The <Code>eval-kit</Code> CLI is the automation surface. Five subcommands.
      </Lead>

      <H2 id="run"><Code>run</Code></H2>
      <P>Execute a suite against an adapter. Produces <Code>run.json</Code>.</P>
      <Pre>{`eval-kit run <suite.yaml> [options]

Options
  -a, --adapter <name>   mock | anthropic              (default: mock)
      --model <model>    adapter model identifier
      --degraded         use degraded mock (simulates regressions)
  -o, --out <path>       output run artifact path      (default: runs/YYYY-MM-DD-<adapter>-<model>.json)

Example
  eval-kit run suites/research-agent-v1.yaml \\
    --adapter anthropic --model claude-sonnet-4-5 \\
    --out runs/baseline.json`}</Pre>

      <H2 id="review"><Code>review</Code></H2>
      <P>Print a run summary and point to the dashboard URL for scoring.</P>
      <Pre>{`eval-kit review runs/baseline.json`}</Pre>

      <H2 id="diff"><Code>diff</Code></H2>
      <P>Compare two scored runs. Prints regressions (✗) and improvements (✓) inline.</P>
      <Pre>{`eval-kit diff runs/baseline.scored.json runs/new.scored.json`}</Pre>

      <H2 id="report"><Code>report</Code></H2>
      <P>Aggregate a scored run into JSON — pass rate, tool-match accuracy, dimension means. Useful in CI.</P>
      <Pre>{`eval-kit report runs/baseline.scored.json`}</Pre>

      <H2 id="init"><Code>init</Code></H2>
      <P>Scaffold a starter repo (<Code>suites/</Code>, <Code>adapters/</Code>, <Code>runs/</Code>, <Code>package.json</Code>, <Code>README.md</Code>).</P>
      <Pre>{`eval-kit init my-evals
# or in-place:
eval-kit init . --name my-evals`}</Pre>

      <H2 id="preflight"><Code>preflight</Code></H2>
      <P>Dry-run the first step of the first task. Verifies adapter wiring before burning tokens on a full suite.</P>
      <Pre>{`eval-kit preflight suites/my-suite.yaml --adapter anthropic`}</Pre>

      <H2 id="ci"><Code>ci</Code></H2>
      <P>Run a suite and gate on tier-1 (auto-scored) regressions. Drop into GitHub Actions.</P>
      <Pre>{`eval-kit ci <suite.yaml> [options]

Options
  -a, --adapter <name>             mock | anthropic
      --model <model>
      --baseline <path>            scored run to compare for regressions
      --min-tool-match <pct>       fail if aggregate tool-match < pct (0-100)
      --min-distraction-catch <pct>
      --max-prefilled <pct>        fail if pre_filled ratio > pct
                                   (guards against LLM-judge creep)
  -o, --out <path>

Example (GitHub Actions)
  eval-kit ci suites/research-agent-v1.yaml \\
    --adapter anthropic --model claude-sonnet-4-5 \\
    --baseline runs/baseline.scored.json \\
    --min-tool-match 80 --max-prefilled 50`}</Pre>
      <P>
        Only tier-1 (structural) metrics can fail a build. Golden-truth and
        dimension regressions are reported but don&apos;t exit non-zero — those
        need human judgment, and CI is deliberately structural-only.
      </P>

      <H2 id="export"><Code>export</Code></H2>
      <P>
        Turn scored runs into training-ready JSONL. Three shapes: <Code>sft</Code> (per-step records with labels), <Code>dpo</Code> (chosen/rejected pairs across two runs), <Code>raw</Code> (full fidelity dump).
      </P>
      <Pre>{`eval-kit export <run.scored.json> [options]

Options
  -f, --format <fmt>           sft | dpo | raw            (default: sft)
      --compared-with <path>   required for --format dpo
  -s, --suite <path>           include real step prompts
      --min-score <n>          filter sft to golden_truth >= n
      --include-prefilled      allow AI drafts in output (default: off)
  -o, --out <path>

Examples
  # SFT pairs for fine-tuning, high-quality only
  eval-kit export runs/v4.2.scored.json \\
    -s suites/research-agent-v1.yaml \\
    --min-score 2 \\
    -o training/sft.jsonl

  # DPO preference pairs across two model versions
  eval-kit export runs/v4.1.scored.json \\
    --format dpo --compared-with runs/v4.2.scored.json \\
    -o training/dpo.jsonl`}</Pre>
      <P>
        Pre-filled scores are excluded by default (see{" "}
        <a href="/docs/paradigm" className="text-accent underline">
          the paradigm
        </a>
        : humans score, not LLMs). Pass <Code>--include-prefilled</Code> only if
        you&apos;re confident in pre-fill calibration and tracking it separately.
      </P>
    </>
  );
}
