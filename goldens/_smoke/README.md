# `_smoke` — plumbing fixture, NOT evidence

**This is not a result. Do not cite it, chart it, or treat it as a measurement
of anything.**

Its only job is to prove that `pnpm verify:goldens` actually executes: that it
discovers a golden, loads the frozen suite and the recorded run, re-scores every
labelled step through the live scoring path, compares against the labels, and
exits non-zero when they disagree. Without it the harness would have nothing to
run on, and "the harness passes" would mean "the harness found nothing to do".

## Why it is not evidence

- **The agent is synthetic.** `run.json` was recorded from
  `createScriptedAdapter` — a test instrument that emits exactly the actions it
  was told to emit. No model was consulted. There is no behaviour here to
  measure, only a shape.
- **The suite is synthetic.** `suite.yaml` is not a real workflow. It is the
  smallest suite that still touches every branch the gate pipeline has: a
  mandated gate, a discretionary blocker, a verifier, and a distraction task.
- **The judgement calls are trivial.** The labels in `expected.json` were
  written by hand, from the trace, in the discipline `goldens/README.md`
  describes — but the run was constructed to make them obvious. Real labels are
  interesting because a reviewer had to decide something. These are not.

## What it does and does not protect

It **does** catch a broken harness: a discovery bug, a loader bug, a comparator
that silently passes everything, an exit code that is always zero.

It does **not** catch a scoring regression in any meaningful sense. The
behaviours it covers are the easy ones. A real corpus is recordings of real
agents on real tasks, labelled by a human who watched them and had to think.

## Files

- `suite.yaml` — the frozen suite the run was recorded against.
- `run.json` — the recorded `Run`. `run_id` and both timestamps are frozen to
  fixed values so the fixture is byte-stable across machines.
- `expected.json` — hand-authored labels, with the same `NOT EVIDENCE` warning
  in its `notes` field so it carries the caveat wherever it is read.
