# Runner operator guide

## Configuration

`experiments/*.yaml` is the scientific source of truth. Commander.js provides the
CLI, `yaml` parses the document, and Zod rejects unknown fields, duplicate model or
effort conditions and invalid values. Duplicate YAML keys, custom tags and aliases
are rejected. `pnpm schema` updates the editor JSON Schema; `pnpm schema:check`
detects drift. Cross-field constraints are enforced at runtime even where JSON
Schema cannot express them.

- `mvp.yaml`: full two-model, three-effort, three-repeat benchmark.
- `pilot.yaml`: two test questions in both languages across every configuration,
  one repeat. Technical calibration only; cannot become a benchmark release.
- `smoke.yaml`: four questions with the deterministic fake provider, two repeats.
  Free and permanently ineligible for the public index.

Changing the model, protocol, token cap, repeats, question subset or seed means a
new run. Provider-native effort names are not equivalent compute budgets. The
initial cap is 16,384 tokens including reasoning; validate it through the pilot,
then rerun the complete affected pair if it needs to change.

At creation, the runner writes `resolved.json`, `identity.json`, `dataset.jsonl`
and `state.sqlite` under `.llang-gap/runs/<run-id>/`. The resolved snapshot records
the full experiment, dataset and protocol hashes, code fingerprint, Git revision,
Node and SDK versions, provider endpoints and initial budget. Resume reads this
snapshot, never the current YAML. Modified inputs, job payloads, runtime source or
runtime dependency closure prevent resume. Changes to website-only dependencies do not block the runner. Keep the original checkout and lockfile available.

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

## Budget and retries

Every live run requires `--budget-usd`. On resume this is the **total** budget,
including earlier attempts, not an additional allowance. Before each request the
single process synchronously reserves a conservative cost bound. It uses prompt
UTF-8 bytes plus API framing, the most expensive applicable input/cache rate, and
the maximum output tokens. Inputs exceeding the supported short-context pricing
bound are rejected.

The reservation is replaced by usage-based cost when known. Reasoning tokens are
already included in output tokens and are not billed twice. Cache reads, writes
and one-hour writes are accounted separately. Missing usage remains `null` in the
public result; its reservation remains charged in the ledger. Unexpected usage
above the bound stops dispatch. This protects against ordinary concurrent spend;
it cannot enforce an external account-wide billing cap or predict price changes.

SDK automatic retries are disabled. The runner retries transport errors, HTTP
408, 429 and 5xx with bounded exponential delay and `Retry-After`. Each attempt is
saved. Other HTTP errors stop new dispatch. Wrong, refused and unparseable completed
answers are never retried. A timeout can still have generated a billable response
server-side; uncertain attempts retain their full reservation. Exactly-once remote
execution is not promised.

Concurrency is per provider. Paired EN/RU requests remain adjacent in a seeded,
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
gold-answer leakage, reference prompts in EN/RU, terminal answer extraction,
bootstrap clustering, every native effort through intercepted SDK HTTP calls,
technical retries, budget reservations, cancellation, restart recovery, locks,
run tampering, truncation and release checksum/scoring verification. It uses no
API credentials and never makes paid calls.
