# my-evals

Eval suite scaffolded by `eval-kit init`.

## Layout

- `suites/` — YAML eval tasks
- `adapters/` — agent adapters (one per model you test)
- `runs/` — run artifacts (gitignored)

## Quickstart

```bash
# Run the starter suite against the mock adapter
pnpm eval-kit run suites/starter.yaml --adapter mock

# Score a run locally (opens dashboard if installed)
pnpm eval-kit review runs/<latest>.json
```

Read the [eval-kit docs](https://github.com/akaieuan/eval-kit) for full usage.
