# Llang Gap

Open, reproducible comparisons of LLM accuracy across prompt languages.

The first benchmark compares English and Russian on **MMLU-ProX Lite**, using five
worked examples per subject and native reasoning effort. The planned matrix is
GPT-6 Astra and Claude Fable 5.1 at low, medium and high effort.

**No model scores have been published.** The included fake provider exercises the
entire pipeline without paid API calls and cannot enter the public leaderboard.

## Quick start

Requires Node **24 LTS** and pnpm **12.3.4**. The workspace pins both; a frozen lockfile
is used in CI. Node's built-in SQLite keeps the runner self-contained.

```sh
corepack enable
pnpm install --frozen-lockfile

# Download only the four pinned EN/RU Parquet files, verify and normalize them.
pnpm bench dataset prepare experiments/smoke.yaml
pnpm bench plan experiments/smoke.yaml --offline

# Free smoke test against real, pinned dataset inputs.
pnpm bench run experiments/smoke.yaml --offline
# Copy runId from the JSON output into the commands below.
pnpm bench status <run-id>
pnpm bench score <run-id>
pnpm bench release build <run-id> --id smoke-v1 --test
pnpm bench release verify .llang-gap/releases/smoke-v1
```

`--offline` disables **dataset downloads**. It does not disable live model APIs.
The fake provider never uses the network. CLI results go to stdout as JSON; progress
and errors go to stderr. Add `--json` for structured errors too.

## Layout

| Location              | Responsibility                                                               |
| --------------------- | ---------------------------------------------------------------------------- |
| `apps/runner`         | Commander CLI, execution, retries, budget ledger, SQLite, release export     |
| `apps/web`            | Next.js site and feature-owned next-intl dictionaries; developed separately  |
| `packages/contracts`  | Strict Zod schemas and shared types                                          |
| `packages/datasets`   | Verified download, Parquet normalization and EN/RU alignment                 |
| `packages/evaluation` | Pinned prompt protocol, terminal-answer parser, scoring and paired bootstrap |
| `packages/providers`  | Official SDK adapters, capabilities, cost accounting and a fake provider     |
| `experiments`         | Strict YAML definitions and generated editor JSON Schema                     |
| `datasets`            | Versioned source manifest; data files stay out of Git                        |
| `results`             | Public release index and small manifests/aggregates                          |
| `.llang-gap`          | Ignored local cache, durable run state and release artifacts                 |

Internal packages expose their source through package exports. Next.js transpiles
the contracts package; the CLI uses `tsx`. Library builds typecheck the source.
There is no separate API server, ORM, database service or distributed queue.

The website runs on a Next.js server (`pnpm --filter @llang-gap/web build`, then
`pnpm --filter @llang-gap/web start`), not a static export. The next-intl proxy
redirects unprefixed URLs using the saved `NEXT_LOCALE` cookie, then the browser's
`Accept-Language`, with English as the fallback. Explicit `/en/` and `/ru/` URLs
take priority; the header language switcher remembers the choice for one year.

## Checks

```sh
pnpm test:core
pnpm typecheck:core
pnpm lint:core
pnpm schema:check

# Entire monorepo, including the website.
pnpm check
pnpm dev
```

Vitest uses synthetic fixtures and intercepted SDK transports. It never contacts
model APIs. Format and lint use **oxfmt + type-aware oxlint**.

## Live experiments

Read [the operator guide](docs/runner.md) and [the exact protocol](docs/protocol.md)
before running paid evaluations. Pricing, model availability and the output cap
must be checked for your API account. The configured USD rates are dated
2026-09-06 and apply to standard, short-context API requests.

Set `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` in the process environment. Local `.env`
files are ignored by Git but are **not automatically loaded** by the CLI. Do not put
keys in experiment YAML or public artifacts.

```sh
pnpm bench plan experiments/pilot.yaml
# Explicit paid pilot: 24 requests across all six model/effort configurations.
pnpm bench run experiments/pilot.yaml --budget-usd 30

# Inspect usage/truncation, freeze the protocol, then commit the source/configuration.
pnpm bench plan experiments/mvp.yaml --offline
# The full run requires an explicit budget chosen from pilot evidence.
pnpm bench run experiments/mvp.yaml --budget-usd <budget>
```

Full MVP: **588 test questions × 2 languages × 6 configurations × 3 repeats =
21,168 requests**, before retries. The `plan` cost is a conservative upper bound
using the output cap; it is not an estimate of typical spend.

Public releases must come from full, complete runs that started from a clean Git
commit. A model refusal or unparseable completed answer scores zero. Technical
missing responses and token truncation block release. Existing releases are never
overwritten; corrected results receive a new release ID.

## Open artifacts

See [release and web integration](docs/releases.md) for the public file contract,
hash verification, independent scoring and explicit staging. The website reads
published aggregates only; a build never calls a model or opens the run database.

MMLU-ProX Lite and the prompt reference retain their upstream attribution. See
[dataset attribution](datasets/mmlu-prox-lite/README.md) and the vendored MIT notice
in `packages/evaluation/reference/LICENSE.md`. Project code is MIT licensed.
