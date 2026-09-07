# Runner operator guide

## Dataset and language selection

`dataset prepare`, `plan` and `run` accept the same selection flags:

```sh
pnpm bench plan experiments/smoke.yaml --dataset mmlu-prox-lite --language ru
pnpm bench run experiments/smoke.yaml --dataset mmlu-prox-lite --languages ru en --compare ru:en
# After registering a compatible manifest and localized protocol inputs:
pnpm bench plan experiments/custom.yaml --dataset my-dataset --languages de fr ja --protocol multiple-choice-v1 --compare fr:ja ja:de
```

`--dataset` resolves `datasets/<id>/manifest.json` and validates its identity.
`--language` selects one language; `--languages` selects a nonempty unique list of
canonical language tags (for example `de`, `ja`, `zh-Hant`). These options replace
the YAML list and clear inherited comparisons. `--compare baseline:language ...`
sets explicit ordered pairs; omitting it after a language override means independent
scores. Without selection flags, the YAML conditions are used exactly as written.
`--protocol` chooses an implemented protocol; unsupported inputs fail before calls.
The plan reports dataset, selected languages, comparisons and counts per language.

Only selected source files are downloaded/decoded. The original full manifest and
selected normalized rows enter the immutable snapshot. Cache output filenames are
scoped by the selected language set. A language limit is not a question subset:
a full single-language run can be released if all other release gates pass.
See [adding datasets](datasets.md) and [the protocol](protocol.md).

## Configuration

`experiments/*.yaml` is the scientific source of truth. Commander.js provides the
CLI, `yaml` parses the document, and Zod rejects unknown fields, duplicate model or
effort conditions and invalid values. Duplicate YAML keys, custom tags and aliases
are rejected. `pnpm schema` updates the editor JSON Schema; `pnpm schema:check`
detects drift. Cross-field constraints are enforced at runtime even where JSON
Schema cannot express them.

- `mvp.yaml`: full two-model, three-effort, three-repeat author-api-v3 comparison.
- `pilot.yaml`: two test questions in both languages across every configuration,
  one repeat. Technical calibration only; cannot become a benchmark release.
- `smoke.yaml`: four questions with the deterministic fake provider, two repeats.
  Free and permanently ineligible for the public index.

Changing the dataset, languages, comparisons, model, protocol, token cap, repeats, question subset or seed means a
new run. Provider-native effort names are not equivalent compute budgets. The
MMLU-ProX author adapter fixes the cap at 2048 tokens including reasoning, matching the
author task numerically. Planning rejects a different cap under this ID. API
limitations and the stricter publication gate are explicit in the
[protocol](protocol.md). Any larger cap requires a separately named protocol and
fresh complete comparison; a pilot never silently changes the author baseline.

At creation, the runner writes `resolved.json`, `identity.json`, `dataset.jsonl`
and `state.sqlite` under `.llang-gap/runs/<run-id>/`. The resolved snapshot records
the full experiment, dataset and protocol hashes, code fingerprint, Git revision,
Node and SDK versions, transport endpoints and initial optional budget. Resume reads this
snapshot, never the current YAML. Modified inputs, job payloads, runtime source or
runtime dependency closure prevent resume. Changes to website-only dependencies do not block the runner. Keep the original checkout and lockfile available.

Historical v1 uses its recorded parser; experimental v2 stays in PR #16 at its
original source revision. Do not change old snapshots, IDs, scores or releases to
v3. Keep the original checkout and dependencies for their verification/resume.
The [current plan](first-comparison.md) uses unchanged data and every test question;
no 100% parse-rate requirement or translation/key correction is a readiness gate.

## Transport and model

Experiment schema v3 identifies each condition with two fields:

```yaml
transport: openrouter
model: openai/gpt-5-nano
```

`transport` selects the SDK adapter, API endpoint and credential. `model` is the
model ID passed unchanged to that API. Supported transports are `openai`
(Responses), `anthropic` (Messages), `openrouter` (Chat Completions through the
OpenAI SDK), and `fake` (local, no network). Native transports use native IDs such
as `gpt-6-astra`; OpenRouter requires `organization/model`. Efforts and token limits remain explicit experiment settings. Dated pricing is optional.
Supported effort labels are `low`, `medium`, `high`, `xhigh`, and `max`; they are
forwarded unchanged. Model IDs are not checked against a capability catalog. The
provider decides whether it accepts the requested model and effort.

One adapter is shared by all models on a transport, with concurrency per transport.
The transport/model pair identifies jobs, results, aggregates and calibration
conditions. Snapshots record `transportMetadata`. The website derives the model
owner from model metadata/namespace, independently of the transport or serving
endpoint. Native and routed results retain distinct IDs and links.

For a fresh run from an old YAML, use `schemaVersion: 3`, `transport` and `model`,
and explicitly specify `languages` and `comparisons` (use `[]` for independent
scores). Never rewrite existing snapshots or releases; schema-v1/v2 artifacts
require their recorded source and dependencies for resume, scoring and verification.

## OpenRouter

Set `OPENROUTER_API_KEY`. `experiments/openrouter-pilot.yaml` is a two-question,
three-effort GPT-5 nano technical pilot: 12 EN/RU jobs, with up to 36 API attempts
under `maxAttempts: 3` (one initial attempt plus two retries per job). It is not a
publishable comparison. Planning reports separate cost bounds for one attempt and
all configured attempts; execution reserves each attempt before dispatch.

```sh
# Planning does not call model APIs or require credentials.
pnpm bench plan experiments/openrouter-pilot.yaml
# Explicitly load the ignored local .env with the pinned Node runtime.
# Run only after agreeing the paid pilot budget.
pnpm exec node --env-file=.env --import tsx apps/runner/src/cli.ts run experiments/openrouter-pilot.yaml --budget-usd 1
pnpm exec node --env-file=.env --import tsx apps/runner/src/cli.ts resume <run-id> --budget-usd 1
```

OpenRouter selects the serving endpoint for the requested model. There is no
upstream setting in the experiment. The adapter disables gateway fallbacks and
requires parameter support, following [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection).
This does not pin an endpoint across requests. Raw private responses retain the
returned gateway provider, model and usage metadata. The `:free` model variant is accepted and preserved in all identities. Other variants
(such as `:online`), auto-model routing and presets are not accepted.

Reasoning uses `reasoning.effort`; prompt compression is disabled. Stops are applied
locally by the protocol scorer, with no server stop or sampling override. Reasoning
fields never enter answer extraction. See [protocol differences](protocols/mmluprox.md#openrouter-transport).
`require_parameters` does not establish support for every effort
value or equal compute across models. CI uses intercepted HTTP responses only.

When estimating costs, use dated rates covering the model's eligible endpoints. The pilot uses the highest rates listed
by the [model endpoints API](https://openrouter.ai/api/v1/models/openai/gpt-5-nano/endpoints)
on 2026-09-07, including Azure Sweden Central: $0.055/M input, $0.011/M cache reads
and $0.44/M output. Both cache-write rates reserve $0.055/M. Costs are token-based estimates at those rates,
not gateway invoices; endpoint selection and pricing changes can affect actual
spending. Missing/invalid usage keeps the reservation charged. Reasoning is counted
within output once. Cache writes have no TTL split: configure both write rates to
the highest applicable rate. Per-request fees, tools, multimodal billing, BYOK fees
and tiered prices are outside this text-only accounting model. Existing budget and
retry rules apply.

## Download and cache

The Git manifest pins Hugging Face revision
`e82aafb9460529687d3c7e51b401d8dd1dd309dd`, four Parquet SHA-256 values and expected
row counts. `dataset prepare`, `plan` and `run` reuse verified local files or download
missing ones. Both test and validation splits are needed. Failed checksum checks
stop processing; corrupt files are not silently replaced. Remove a known-corrupt
cache file explicitly, then prepare again.

Parquet is read with the pure JavaScript `hyparquet` package. Each preparation
verifies raw bytes and regenerates normalized JSONL. There are 588 test and 70
validation rows per language. The normalizer verifies IDs, category, number/order
of answer slots and gold labels; it does not establish translation fidelity.

## Forecasting costs

`bench plan` separates `forecast` from the existing `upperBoundUsdOneAttempt`
and `upperBoundUsdAllAttempts` safety reservations. Without calibration, `forecast`
is `null`: the reservation is not an expected invoice.

```sh
pnpm bench plan experiments/mvp.yaml --offline --calibrate-from /absolute/path/to/pilot-run
```

Use a completed run directory containing `resolved.json`, `identity.json`, and
`state.sqlite`. The command reads it without modifying the journal or calling model
APIs. It checks the dataset hash, protocol, model, effort and output cap. Every
requested model/effort/language condition must have recorded usage; unknown usage
and incomplete runs fail rather than produce a partial estimate.

The forecast reprices mean observed usage separately for every model, effort and
language using the target experiment's rates, then multiplies by target requests
(including repeats). Cache categories and reasoning-inclusive output are accounted
as in billing. It includes incorrect, refused and truncated outcomes. Each condition
reports sample responses and unique questions; repeats do not increase question
coverage. Technical retries and uncertain charges are excluded from this one-attempt
forecast. The separate attempt reservation covers the configured retry limit.

`outputCapScenarioUsd` substitutes the full output cap while keeping observed mean
input/cache usage. This is a sensitivity scenario, not an upper bound or confidence
interval. Both estimates assume representative input and cache usage; different
question lengths, subjects and reasoning difficulty can change spending. A two-question
technical pilot supports only a provisional forecast, not a precise full-run budget.
Forecasting is opt-in and requires target prices. It never gates an unbudgeted run.

## Budget and retries

Cost estimation and `--budget-usd` are optional. `run` does not require a preceding
`plan`, rates, or a budget; `resume` without a budget retains the last recorded
budget setting (including no budget). An explicit resume budget is the **total**
budget, including earlier attempts, not an additional allowance.

Omit a model's `pricing` block when prices are unknown. Its reservations, completion
costs and execution total remain `null`; token usage and responses are still saved.
Explicit zero rates are valid, including for OpenRouter `:free` models, and produce
zero token-based cost when usage is known. Missing usage is still unknown. No rate
is inferred from a model suffix. New SQLite journals use schema v2 with nullable
amounts; existing journals and immutable snapshots are not rewritten.

With an explicit budget, every model needs prices and prior charged/reserved totals
must be known. Before each request the single process synchronously reserves a
conservative cost bound. It uses prompt
UTF-8 bytes plus API framing, the most expensive applicable input/cache rate, and
the maximum output tokens. Inputs exceeding the supported short-context pricing
bound are rejected.

The reservation is replaced by usage-based cost when known. Reasoning tokens are
already included in output tokens and are not billed twice. Cache reads, writes
and one-hour writes are accounted separately. Missing usage remains `null` in the
public result; its reservation remains charged in the ledger when rates exist. With an explicit budget, unexpected usage
above the bound stops dispatch. This protects against ordinary concurrent spend;
it cannot enforce an external account-wide billing cap or predict price changes.

SDK automatic retries are disabled. The runner retries transport errors, HTTP
408, 429 and 5xx with bounded exponential delay and `Retry-After`. Each attempt is
saved. Other HTTP errors stop new dispatch. Wrong, refused and unparseable completed
answers are never retried. A timeout can still have generated a billable response
server-side; uncertain attempts retain their full reservation. Exactly-once remote
execution is not promised.

Concurrency is per transport. Selected language conditions remain adjacent in a seeded,
shuffled schedule; the first language alternates. This seed controls scheduling
and statistics, not model generation. Request wall time is recorded as observed
API latency, without presenting it as pure inference time.

## Stop and resume

```sh
# A reversible pause after dispatching 12 jobs, preserving the full experiment.
pnpm bench run experiments/mvp.yaml --budget-usd 30 --max-jobs 12
pnpm bench status <run-id>
pnpm bench resume <run-id> --budget-usd 100 --concurrency 2
```

Ctrl+C stops new dispatch and waits for active calls to be saved. Completed jobs
are not reissued. `--max-jobs` counts dispatched jobs, excluding technical retries.

An exclusive lock prevents two processes from operating on a run. If a process
dies abruptly, `bench unlock <run-id>` removes its lock only after checking that
the recorded owner on the same host no longer exists. On resume, unfinished calls
become `uncertain`; they are not silently repeated:

```sh
pnpm bench unlock <run-id>
pnpm bench resume <run-id> --budget-usd 100 --retry-uncertain
# After resolving an operational API failure, optionally raise the total attempt cap.
pnpm bench resume <run-id> --budget-usd 100 --retry-failed --max-attempts 5
```

Budget, concurrency and retry-limit changes are recorded in the event log. These
commands never reset successful answers. Keep the entire run directory on durable
storage. Back up after the runner has exited; copying only `state.sqlite` during
an active WAL session is not a consistent backup.

## SQLite and failure behavior

Node 24's built-in `node:sqlite` avoids native package compilation and an ORM.
The journal uses WAL, `synchronous=FULL`, foreign keys, short transactions and a
versioned schema. Network calls occur outside transactions. A response and its
completed status commit together. Unique job identities and attempt numbers stop
duplicate local records. The web app never opens this database.

The supported deployment is one process per run on a persistent local filesystem.
Shared network filesystems, multiple hosts and distributed workers are outside MVP.

## Validation performed

The automated suite covers strict config parsing, dataset pairing and corruption,
gold-answer leakage, reference prompts for all pinned adapter subjects, first-match author
extraction and the frozen historical terminal parser,
bootstrap clustering, every native effort through intercepted SDK HTTP calls,
technical retries, budget reservations, cancellation, restart recovery, locks,
run tampering, truncation and release checksum/scoring verification. It uses no
API credentials and never makes paid calls.
