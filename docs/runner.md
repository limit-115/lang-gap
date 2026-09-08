# Runner operator guide

## CLI and YAML configuration

The website's **Build a run** page generates CLI-only commands for bash/zsh.
Choose your dataset, protocol, languages and transport, then enter exact model IDs.
The guided builder has four steps: dataset and languages, models and reasoning,
run size and controls, then review. Summary rows return to the corresponding step
without losing your settings. Reloading starts a new setup. Dataset changes clear
the language selection; use language search for larger catalogs. **Select all**
selects every language supported by the chosen protocol, including languages
hidden by search; **Clear selection** deselects them. Question counts appear once
in each dataset card, with a range when language splits differ.

**Local test** selects the fake transport and adds an editable synthetic model ID.
Advanced settings are collapsed initially and open automatically only when you
try to continue with an invalid advanced value. The command updates as you edit.
In the review step, **View command** and **Copy command** become available only
when the configuration is valid. Open **View command** to inspect it or switch modes.
Step checkmarks appear after continuing through a valid step, not from default values.
**Check plan** produces a `plan` command with the
same experiment settings; it may download dataset files but never calls models.
Copy the command and run it from your cloned repository root after installing the
pinned tools and dependencies. Supply transport API keys locally through `.env`
or the environment; the website does not receive them or execute commands.

**Quick check** limits unique questions per language; **All questions** uses each
selected test split. The displayed request count includes models, efforts and
repeats, excludes technical retries, and remains the full experiment count when
**Pause after this many jobs** is set. Advanced settings include explicit ordered
comparisons, execution controls and optional token rates for recorded usage.
Unknown pricing is never shown as zero cost. Rates and model settings apply to every selected model. Use YAML
for mixed transports or different settings/rates per model. API access and
effort support, dataset integrity and comparison alignment still require local
CLI/API validation.

Builder choices come from public dataset manifests and the evaluation adapters'
`run-catalog` export, rather than website locales or published leaderboard rows.
Deployments must include `datasets/*/manifest.json` (covered by Next.js output
tracing). Adding a dataset or protocol updates the available choices through
these inputs; no question text, answers or private run state is sent to the site.

`run`, `plan` and `dataset prepare` accept an optional YAML path followed by flags.
A run can be configured entirely through the CLI. `plan` is optional and never
calls model APIs. It reports question counts, configurations, repeats and total
requests. For example, this local fake run needs no YAML or prices:

```sh
pnpm bench run --id cli-smoke --dataset mmlu-prox-lite \
  --protocol mmluprox-lite-5shot-author-api-v3 --max-output-tokens 2048 --languages ru,en \
  --transport fake --models fake-one,fake-two --efforts low,medium,high,xhigh,max \
  --question-limit 2 --repeats 3 --concurrency 2 --max-jobs 5
pnpm bench resume <run-id>
```

For live calls, choose a transport, supply its API key in the repository root
`.env` file or the process environment and pass its model IDs unchanged, for example `--transport openrouter
--models organization/model:free,organization/another-model`. No model catalog or
effort-capability lookup runs before dispatch. The API may reject a request.

Every CLI command, including `run` and `resume`, automatically loads `.env` from
the repository root, regardless of the working directory. Existing process
environment values take precedence, including empty values. A missing `.env` is
allowed; other file read errors are reported. Copy `.env.example` to `.env` and
fill in the key for your transport, or keep using exported environment variables.

YAML remains useful for named, reproducible experiments. Flags override YAML;
defaults fill fields absent from both. Overrides are applied before final schema
validation, so a CLI value can replace an obsolete YAML setting. Unknown fields,
duplicate conditions, duplicate YAML keys, custom tags and aliases are rejected.
`pnpm schema` regenerates the editor schema; `pnpm schema:check` detects drift.

```sh
pnpm bench plan experiments/smoke.yaml --models fake-one,fake-two \
  --efforts low max --languages ru en --question-limit 2 --repeats 3
pnpm bench run experiments/smoke.yaml --all-questions --no-pricing
```

Lists accept commas, spaces, or both (including `--models=a,b,c`). An explicit
model list replaces the YAML list. Matching transport/model conditions retain
model-specific settings; new models use CLI settings and defaults. `--transport`
applies to every selected model. Rates never transfer to a different model or
transport. Without a transport override, a new model can inherit the YAML's single
transport; mixed-transport YAML requires an explicit transport for new IDs.

| Setting                            | CLI flag                                                                                                                                                                       | Default without YAML                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Experiment label                   | `--id`                                                                                                                                                                         | `cli` (the run ID also includes date and a random suffix) |
| Dataset                            | `--dataset`                                                                                                                                                                    | Required                                                  |
| Protocol                           | `--protocol`                                                                                                                                                                   | Required                                                  |
| Benchmark languages                | `--languages` or `--language`                                                                                                                                                  | Required                                                  |
| Models / transport                 | `--models`, `--transport`                                                                                                                                                      | Required                                                  |
| Reasoning efforts                  | `--efforts`                                                                                                                                                                    | `medium`                                                  |
| Combined reasoning/output cap      | `--max-output-tokens`                                                                                                                                                          | No API cap (API defaults apply)                           |
| Repeats / selection seed           | `--repeats`, `--seed`                                                                                                                                                          | 1 / 42                                                    |
| Unique test questions per language | `--question-limit`, `--all-questions`                                                                                                                                          | Entire selected test split                                |
| Concurrency per transport          | `--concurrency`                                                                                                                                                                | 1                                                         |
| Total attempts / request timeout   | `--max-attempts`, `--timeout-ms`                                                                                                                                               | 3 / 120000 ms                                             |
| Optional rates                     | `--pricing-as-of`, `--pricing-source`, `--input-per-million`, `--cached-input-per-million`, `--cache-write-per-million`, `--cache-write1h-per-million`, `--output-per-million` | Unknown                                                   |

Price flags apply to selected models and override matching YAML rates. A complete
pricing block needs its date, source URL and all five rates. `--no-pricing` clears
inherited rates; zero rates are valid. `--all-questions` clears `questionLimit`.

`questionLimit` counts **unique test questions per language**, before expanding
models, efforts and repeats. With 2 questions in each of 2 languages, 3 models,
5 efforts each and 3 repeats, the plan has 180 requests, before technical retries.
For unequal language sets or per-model effort lists, the plan reports the actual
counts. `--max-jobs` only pauses dispatch; it does not reduce the saved experiment.

## Console logs and diagnostic journals

The CLI uses [LogTape](https://logtape.org/manual/config). Logs go to **stderr**;
command results remain a single JSON document on **stdout**, including when stdout
is redirected. `--json` also requests JSON for command errors. Redirect stdout to
save a result without losing live progress:

```sh
pnpm --silent bench --json run experiments/smoke.yaml > run-summary.json
```

The default console level is `info`. Timestamps are UTC. Color is enabled only on
an interactive stderr; `NO_COLOR` disables it. Output is append-only, so scrollback,
SSH sessions and redirected logs retain the same history.

| Level     | What it tells the operator                                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `debug`   | Every attempt's start and saved response, job/condition identity, latency, usage, cost and request ID; verified dataset files and diagnostic stack frames |
| `info`    | Preparation, downloads, run ID and directory, execution settings, progress, condition results and completion                                              |
| `warning` | Retriable failures and their delay, refusals/truncation/unparseable answers, missing usage, interruption and uncertain crash recovery                     |
| `error`   | Non-retryable transport failures, exhausted attempts, execution/CLI failures and unusable logging destinations                                            |

Progress appears at start/end, on completions at most once per five seconds, and
on a ten-second heartbeat while requests or retries are waiting. It includes saved,
active, retrying, queued, failed and uncertain counts, elapsed time, the oldest
active call, and recorded cost. Queued jobs exclude current retry waits;
the durable `pending` count in JSON/status includes them. Costs remain `unknown`
when accounting is unknown.

An error identifies the transport/model, effort, language, question, repeat and
attempt; it retains the API's diagnostic, HTTP status/code and request ID
when available. Retriable failures say when the next attempt is due. A terminal
failure explains why dispatch stopped and suggests the applicable recovery step.
Ctrl+C/SIGTERM cancels retry waits immediately and still drains active API calls.

At the end, each model/effort/language condition shows saved/expected coverage,
correct answers, observed accuracy, parse failures, refusals and truncation.
Partial coverage is provisional; these counters are not a published aggregate
or paired analysis. Use `bench score` for analysis. `bench status <run-id>` also
shows these counters and the five most recent failed/uncertain attempts (including
attempts that later recovered), without contacting model APIs.

### Configuration

These environment variables also work in the root `.env`; existing process values
retain precedence. No experiment/YAML setting is needed.

| Variable           | Default  | Values / effect                                                                                                                                         |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LLANG_LOG_LEVEL`  | `info`   | Console threshold: `debug`, `info`, `warning`, `error`                                                                                                  |
| `LLANG_LOG_FORMAT` | `pretty` | `pretty` for humans; `json` for JSONL events on stderr                                                                                                  |
| `LLANG_LOG_FILE`   | `auto`   | `auto`: append to `<run-directory>/runner.jsonl` for `run`/`resume`; `off`: disable the journal; any other value: append to that path for every command |
| `NO_COLOR`         | unset    | Any value disables ANSI color                                                                                                                           |

```sh
# Show individual requests in the console.
LLANG_LOG_LEVEL=debug pnpm bench resume <run-id>
# Quiet console; detailed debug events still go to the run's journal.
LLANG_LOG_LEVEL=warning pnpm bench resume <run-id>
# Include preparation/validation failures before a run directory exists.
LLANG_LOG_FILE=.llang-gap/logs/operator.jsonl pnpm bench plan experiments/smoke.yaml
# JSONL stderr and an independent JSON result on stdout.
LLANG_LOG_FORMAT=json pnpm --silent bench --json resume <run-id> > result.json 2> events.jsonl
```

File paths are relative to the invoking working directory. New journal files use
mode `0600`; parent directories created for them use `0700`. The file always
receives `debug` and above, independently of the console threshold. `auto` starts
once the durable run is ready; earlier failures remain on stderr. Resume appends,
with a new `sessionId` to distinguish invocations. Records include `timestamp`,
`level`, `category`, `message`, and `properties` containing a stable `event` name
and run/job context where applicable. For example:

```sh
jq 'select(.properties.event == "request.failed") | .properties' .llang-gap/runs/<run-id>/runner.jsonl
tail -f .llang-gap/runs/<run-id>/runner.jsonl
```

Journals contain diagnostics, never intentionally serialized prompts, target
answers, model output, headers or raw SDK bodies. API diagnostic messages are
bounded; known credentials, echoed full prompts and terminal control characters
are removed. Review API diagnostic text before sharing it. Journals
are private local artifacts, excluded from releases and Git. They are written
without an application buffer and closed on normal exit; SQLite remains the
authoritative, transactionally durable record. A file failure before dispatch
aborts the command; a write failure during execution is reported on stderr and
disables that sink while responses continue to be saved. There is no automatic
rotation: archive/remove diagnostic journals with the corresponding run, and use
separate explicit paths for concurrent processes. Removing a journal does not
change results or make uncertain API calls safe to repeat.

`run`/`resume` results include `stopReason`. Full completion and deliberate
`--max-jobs` pauses exit `0`; unresolved failed/uncertain jobs and execution
errors exit `1`; SIGINT/SIGTERM exit `130`/`143`. A successful `status` command exits
`0` even when the inspected run has failures. Completed but incorrect, refused or
unparseable answers are benchmark outcomes and do not make execution fail.

Run snapshots and journals require their recorded source and dependency lock
for resume and verification. Keep the original checkout available.

## Dataset and language selection

`--dataset` resolves `datasets/<id>/manifest.json` and validates its identity.
There is no universal dataset or benchmark language list. Language tags must be
canonical (for example `de`, `ja`, `zh-Hant`). Language overrides replace the YAML
list and clear inherited comparisons. Optional `--compare baseline:language ...`
sets ordered pairs; `comparisons` may be omitted in YAML for independent scores.
`--protocol` chooses an implemented adapter; unsupported dataset/language inputs
fail before calls. The plan reports the selected conditions and request counts.

Only source files contributing to selected languages are downloaded/decoded.
Shared files may contain other languages or translation variants; all declared
partitions are checked before selecting normalized rows. The original full manifest and
selected normalized rows enter the immutable snapshot. Cache output filenames are
scoped by the selected language set. A full single-language run can be released
if all other release gates pass. See [adding datasets](datasets.md) and
[the protocol](protocol.md).

Changing the dataset, languages, model, protocol, token cap, repeats, question subset or seed means a
new run. API-native effort names are not equivalent compute budgets. The
MMLU-ProX author adapter fixes the cap at 2048 tokens including reasoning, matching the
author task numerically. Planning rejects a different cap under this ID. API
limitations and the stricter publication gate are explicit in the
[protocol](protocol.md). Any larger cap requires a separately named protocol and
fresh complete comparison; a pilot never silently changes the author baseline.

At creation, the runner writes `resolved.json`, `identity.json`, `dataset.jsonl`
and `state.sqlite` under `.llang-gap/runs/<run-id>/`. The resolved snapshot records
the full experiment, dataset and protocol hashes, code fingerprint, Git revision,
Node and SDK versions and transport endpoints. Resume reads this
snapshot, never the current YAML. Modified inputs, job payloads, runtime source or
runtime dependency closure prevent resume. Changes to website-only dependencies do not block the runner. Keep the original checkout and lockfile available.

Historical v1 uses its recorded parser; experimental v2 stays in PR #16 at its
original source revision. Do not change old snapshots, IDs, scores or releases to
v3. Keep the original checkout and dependencies for their verification/resume.
The [current plan](first-comparison.md) uses unchanged data and every test question;
no 100% parse-rate requirement or translation/key correction is a readiness gate.

## Omitting the output token cap

Without `--max-output-tokens`, CLI-only runs omit the API output-token parameter.
Pass `--max-output-tokens <count>` to set a cap. No separate disabling flag is
needed. YAML may supply an explicit numeric cap; CLI values override it. An omitted
YAML cap or `maxOutputTokens: null` also means no API cap. The resolved snapshot
always records a number or null, so the choice is reproducible.

```sh
# Set OPENROUTER_API_KEY in the repository root .env or export it in this shell.
pnpm bench run --dataset mmlu-prox-lite \
  --protocol mmluprox-lite-5shot-flexible-api-v1 \
  --transport openrouter --models inclusionai/ling-3.0-flash-fin:free \
  --languages ru en --efforts low --question-limit 10
```

OpenRouter and OpenAI omit `max_tokens` and `max_output_tokens`, respectively.
API defaults, context limits and output ceilings still apply; null does not
promise unlimited generation or equal compute across endpoints. Native Anthropic
requires `max_tokens` and rejects this mode before any API call. See the
[OpenRouter request schema](https://openrouter.ai/docs/api/reference/overview) and
[Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create).
The fake transport supports null for synthetic verification.

The pinned MMLU-ProX author-v3 condition still requires 2048. Select the separate
`mmluprox-lite-5shot-flexible-api-v1` protocol for adjustable or omitted caps with
the same pinned prompts and extraction. Historical v1 also requires a numeric cap.
The dataset-independent `multiple-choice-v1` accepts either numeric or null caps.
No protocol is changed automatically by a flag.

Runs record usage and calculate completion costs when prices and usage are
available, including when the output cap is omitted. The `:free` suffix never
supplies prices automatically.

Null is preserved in job identity, snapshots, resume, analysis and release artifacts.
Switching between numeric and null caps creates a new run; post-run comparisons
reject mismatched caps. Two null caps describe the same omission policy,
not a guarantee of identical API limits. Truncation still blocks publication.

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
API service decides whether it accepts the requested model and effort.

Use **transport** for this component in code, CLI flags and the website. Its
implementation lives in `packages/transports` (`@llang-gap/transports`). A model's
**owner** is its developer, independent of the transport used to reach it. The
OpenRouter API's `provider` field has a separate meaning: upstream serving and
routing. Keep that external field unchanged; it is not an alternative name for
our transport. React context providers are also unrelated to model transports.

Transport failures use `TransportError`; a non-retryable transport failure stops
the run with the CLI JSON `stopReason: "transport-error"`.

One adapter is shared by all models on a transport, with concurrency per transport.
The transport/model pair identifies jobs, results and aggregate
conditions. Snapshots record `transportMetadata`. The website derives the model
owner from model metadata/namespace, independently of the transport or serving
endpoint. Native and routed results retain distinct IDs and links.

For a fresh run from an old YAML, use `schemaVersion: 3`, `transport` and `model`,
and explicitly specify `languages`. Omit `comparisons` or use `[]` for independent
scores. Never rewrite existing snapshots or releases; schema-v1/v2 artifacts
require their recorded source and dependencies for resume, scoring and verification.

## OpenRouter

Set `OPENROUTER_API_KEY` in the repository root `.env` or the process environment.
`experiments/openrouter-pilot.yaml` is a two-question,
three-effort GPT-5 nano technical pilot: 12 EN/RU jobs, with up to 36 API attempts
under `maxAttempts: 3` (one initial attempt plus two retries per job). It is not a
publishable comparison. Planning reports the request count and the configured attempt limit.

```sh
# Planning does not call model APIs or require credentials.
pnpm bench plan experiments/openrouter-pilot.yaml
# The CLI automatically loads the ignored repository root .env.
# Run only after agreeing the paid pilot budget.
pnpm bench run experiments/openrouter-pilot.yaml
pnpm bench resume <run-id>
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

For recorded usage, use dated rates covering the model's eligible endpoints. The pilot uses the highest rates listed
by the [model endpoints API](https://openrouter.ai/api/v1/models/openai/gpt-5-nano/endpoints)
on 2026-09-07, including Azure Sweden Central: $0.055/M input, $0.011/M cache reads
and $0.44/M output. Both cache-write rates are $0.055/M. Costs are token-based estimates at those rates,
not gateway invoices; endpoint selection and pricing changes can affect actual
spending. Missing/invalid usage leaves cost unknown. Reasoning is counted
within output once. Cache writes have no TTL split: configure both write rates to
the highest applicable rate. Per-request fees, tools, multimodal billing, BYOK fees
and tiered prices are outside this text-only accounting model. Retry rules apply.

## Download and cache

Each dataset manifest pins its hosting service, repository revision, source
checksums, raw row counts and normalized language/split counts. Schema-v1/v2
manifests use Hugging Face; v3 also supports GitHub and files shared by several
languages. `dataset prepare`, `plan` and `run` reuse verified local files or
download missing ones. Failed checksum checks stop processing; corrupt files are
not silently replaced. Remove a known-corrupt cache file explicitly, then prepare
again. Every preparation verifies raw bytes and regenerates selected-language
normalized JSONL.

For MMLU-ProX Lite, the manifest pins Hugging Face revision
`e82aafb9460529687d3c7e51b401d8dd1dd309dd`, four Parquet SHA-256 values and expected
row counts. Both test and validation splits are needed.

Parquet is read with the pure JavaScript `hyparquet` package. Each preparation
verifies raw bytes and regenerates normalized JSONL. There are 588 test and 70
validation rows per language. The normalizer verifies IDs, category, number/order
of answer slots and gold labels; it does not establish translation fidelity.

For mmPISA, select `--dataset mmpisa` or `--dataset mmpisa-machine` with
`--protocol multiple-choice-v1`. Each condition has 25 test questions per language
and no validation split. The one pinned CSV contains all languages and both
translation variants; even a single-language preparation needs that file.
See the [mmPISA guide](datasets/mmpisa.md) and `experiments/mmpisa-smoke.yaml`.

## Usage accounting and retries

`run` can execute directly. Optional token rates apply only to recorded usage;
`plan` validates inputs and counts requests.

Omit a model's `pricing` block when prices are unknown. Its completion costs and
execution total remain `null`; token usage and responses are still saved.
Explicit zero rates are valid and produce zero token-based cost when usage is
known. Missing usage is still unknown. No rate is inferred from a model suffix.
Reasoning tokens are already included in output and are not counted twice.
Cache reads, writes and one-hour writes are accounted separately.

An attempt starts with an unknown charge. A completed response records its
usage-based cost; a definite failed request records zero. An ambiguous failure
keeps its charge unknown even after a successful retry. The `chargedUsd` execution
total is `null` whenever any attempt has an unknown charge.

New run snapshots use schema v4 and SQLite journals use schema v3. Existing local
state and published artifacts remain immutable; use their recorded source and
dependencies to resume or verify them. No journal migration is performed.

SDK automatic retries are disabled. The runner retries transport errors, HTTP
408, 429 and 5xx with bounded exponential delay and `Retry-After`. Each attempt is
saved. Other HTTP errors stop new dispatch. Wrong, refused and unparseable completed
answers are never retried. A timeout can still have generated a billable response
server-side; uncertain attempts retain an unknown charge. Exactly-once remote
execution is not promised.

Concurrency is per transport. Selected language conditions remain adjacent in a seeded,
shuffled schedule; the first language alternates. This seed controls scheduling
and statistics, not model generation. Request wall time is recorded as observed
API latency, without presenting it as pure inference time.

## Analyze saved runs

No predeclared `comparisons` are needed to run or publish independent scores.
Select language gaps after execution, without changing the run snapshot:

```sh
pnpm bench score <run-id> --compare ja:de,de:fr
pnpm bench release build <run-id> --id <release-id> --compare ja:de de:fr
```

Use languages actually present in the saved run. These commands record the
selected language comparisons in `analysis.json`; the release builder records
its own selection, so pass `--compare` there as well when publishing those gaps.
Without the flag, the run's optional YAML comparison preset is used.

For comparisons between models, efforts or languages, including separate runs:

```sh
pnpm bench compare <run-id> --models organization/model-a,organization/model-b \
  --efforts low,max --languages ja,de --id model-language-analysis
pnpm bench compare <first-run-id> <second-run-id> --languages ja de --efforts max
```

With no filters, every saved condition is considered. `--models`, `--transports`,
`--efforts` and `--languages` accept commas or spaces. Each unordered pair is
reported once in deterministic condition order; `baseline` and `candidate` point
to the full condition identities in the report. Positive `gapPp` favors the named
baseline. Incompatible pairs are listed with reasons; no common-question subset
is silently substituted. Across runs, saved dataset contents must match for every
shared language, even when the selected comparison uses different languages.
Different language selections alone do not make runs incompatible. See the
[compatibility and statistics rules](protocol.md#accuracy-and-post-run-comparisons).

The command writes an exclusive `.llang-gap/analyses/<id>.json` artifact (or uses
a generated ID). It contains the selection, bootstrap seed (`--seed`, default 42),
10,000-sample method, source configuration/dataset/protocol/result hashes, condition
scores, gaps and incompatible pairs. It includes no raw API response or local
source paths. Repeating the same selection and seed reproduces its statistics;
source run directories remain unchanged. Keep source runs or their release
artifacts with the report for audit and publication. These general reports do not
enter the website release index automatically.

## Stop and resume

```sh
# A reversible pause after dispatching 12 jobs, preserving the full experiment.
pnpm bench run experiments/mvp.yaml --max-jobs 12
pnpm bench status <run-id>
pnpm bench resume <run-id> --concurrency 2
```

Ctrl+C stops new dispatch and waits for active calls to be saved. Completed jobs
are not reissued. `--max-jobs` counts dispatched jobs, excluding technical retries.

An exclusive lock prevents two processes from operating on a run. If a process
dies abruptly, `bench unlock <run-id>` removes its lock only after checking that
the recorded owner on the same host no longer exists. On resume, unfinished calls
become `uncertain`; they are not silently repeated:

```sh
pnpm bench unlock <run-id>
pnpm bench resume <run-id> --retry-uncertain
# After resolving an operational API failure, optionally raise the total attempt cap.
pnpm bench resume <run-id> --retry-failed --max-attempts 5
```

`--retry-failed` and `--retry-uncertain` only requeue jobs below the **total**
attempt limit; they do not reset attempt counts. For example, a failed job with
three recorded attempts and `maxAttempts: 3` needs `--max-attempts 5` to allow up
to two additional attempts. Otherwise it stays failed and can produce
`Dispatching 0/... jobs`; the CLI warns when requested retries are blocked by the
limit. The supported maximum is five total attempts per job. Pass the raised
`--max-attempts` on each resume that needs it; omitting it uses the original
experiment's limit.

Concurrency and retry-limit changes are recorded in the event log. These
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
technical retries, unknown charges, cancellation, restart recovery, locks,
run tampering, truncation and release checksum/scoring verification. It uses no
API credentials and never makes paid calls.

## Choose a dataset and its protocol

Use `pnpm bench dataset list` to inspect available datasets, their recommended
protocol, other available protocols and supported languages. This reads setup
metadata only, without downloading data or sending model requests.

For a CLI-only run, `--protocol` may be omitted: the dataset recommendation is
resolved and saved as an explicit protocol ID. A recommended protocol's fixed
output cap fills an absent cap; explicit caps are preserved and validated against
the protocol. For example, MMLU-ProX's author recommendation requires 2048 tokens.
An explicit YAML or CLI protocol is preserved. When `--dataset` changes the YAML
dataset, its inherited protocol is replaced by the new recommendation unless
`--protocol` is also supplied. Model settings and selected languages stay explicit;
incompatible settings fail validation rather than being silently adjusted.

The run builder follows the same dataset recommendations and emits an explicit
`--protocol` in copied commands. See [dataset registration](datasets.md#available-protocols).
