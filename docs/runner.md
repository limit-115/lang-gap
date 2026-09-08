# Runner operations

## CLI and YAML configuration

The website's Build a run page generates commands; run them locally. Use YAML for per-model settings.
Inspect flags with `pnpm bench --help` and examples in [experiments](../experiments).

```sh
pnpm bench dataset list
pnpm bench plan experiments/mmpisa-smoke.yaml
pnpm bench run experiments/mmpisa-smoke.yaml
pnpm bench status <run-id>
```

The smoke example uses fake transport. `plan` never calls models; `--offline` only blocks dataset downloads.
Live work requires an explicit request and budget. Put keys in ignored root `.env` or process environment.
Process environment wins. Never put credentials or private run artifacts in commits or review evidence.
Flags override YAML. Dataset changes select its recommendation unless a protocol override is supplied.
Language overrides clear inherited comparisons. Check the resolved plan before executing.

## Omitting the output token cap

Omitted/null caps omit the API parameter unless the recommended protocol supplies a fixed cap.
API defaults still apply; native Anthropic requires a numeric cap. Author-v3 requires exactly 2048.
Use the separately named flexible MMLU-ProX protocol for other caps. Effort labels do not equate compute.

## OpenRouter

Use `OPENROUTER_API_KEY`, `--transport openrouter` and an exact `organization/model` ID.
Native and routed models are distinct conditions. Routing does not pin a serving endpoint.
Model/effort acceptance is decided by the API. `:free` does not automatically supply zero pricing.
Unknown prices or usage mean unknown cost; ambiguous attempts keep total cost unknown even after retry.

## Stop and resume

Ctrl+C stops dispatch and saves active calls; `--max-jobs` pauses without shrinking the experiment.
Resume with `pnpm bench resume <run-id>` from the recorded checkout and lockfile.
After a crash, `pnpm bench unlock <run-id>` checks the old process is gone before removing its lock.
`--retry-uncertain` can duplicate a remotely completed, billable request; inspect saved state first.
`--retry-failed --max-attempts 5` raises the total attempt limit, not the number of additional retries.
Pass the raised limit on each resume that needs it. Completed answers are never reissued.
Keep the whole `.llang-gap/runs/<run-id>` directory; back it up only after the runner exits (SQLite WAL).
Use one process per run on persistent local storage; shared network filesystems are unsupported.
Analyze saved runs with `pnpm bench compare <run-id...>`; see [statistical limits](protocol.md).
