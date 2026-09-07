<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/svg/llang-gap-logo-white.svg">
    <img src="brand/svg/llang-gap-logo-black.svg" alt="Llang Gap" width="320">
  </picture>
</h1>

**See how LLM accuracy changes across languages—with open results you can check.**

Llang Gap compares model accuracy on the same academic questions in different
prompt languages. Read each language’s score alongside the gap and its uncertainty
interval, then inspect the prompts and responses or independently recompute the
scores from a published release.

The first comparison is planned for **English and Russian** on **MMLU-ProX Lite**:
588 test questions per language, five worked examples per subject, and GPT-6 Astra
and Claude Fable 5.1 at low, medium and high reasoning effort. This measures
academic multiple-choice accuracy; use it to identify models for further testing
on your own tasks. More languages will follow over time.

**No benchmark scores have been published yet.** The included fake provider lets
you try the full pipeline without paid API calls. Its synthetic answers cannot
appear in public results.

Read [how the comparison works](docs/protocol.md) and
[how to check a published release](docs/releases.md).

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
pnpm bench release build <run-id> --id smoke-author-v3 --test
pnpm bench release verify .llang-gap/releases/smoke-author-v3
```

`--offline` disables **dataset downloads**. It does not disable live model APIs.
The fake provider never uses the network. CLI results go to stdout as JSON; progress
and errors go to stderr. Add `--json` for structured errors too.

## Layout

| Location              | Responsibility                                                                        |
| --------------------- | ------------------------------------------------------------------------------------- |
| `apps/runner`         | Commander CLI, execution, retries, budget ledger, SQLite, release export              |
| `apps/web`            | Next.js site and feature-owned next-intl dictionaries; developed separately           |
| `packages/contracts`  | Strict Zod schemas and shared types                                                   |
| `packages/datasets`   | Verified download, Parquet normalization and cross-language alignment                 |
| `packages/evaluation` | Pinned prompt protocol, versioned author/legacy parsers, scoring and paired bootstrap |
| `packages/providers`  | Official SDK adapters, capabilities, cost accounting and a fake provider              |
| `experiments`         | Strict YAML definitions and generated editor JSON Schema                              |
| `datasets`            | Versioned source manifest; data files stay out of Git                                 |
| `results`             | Public release index and small manifests/aggregates                                   |
| `.llang-gap`          | Ignored local cache, durable run state and release artifacts                          |

Internal packages expose their source through package exports. Next.js transpiles
the contracts package; the CLI uses `tsx`. Library builds typecheck the source.
There is no separate API server, ORM, database service or distributed queue.

The website runs on a Next.js server (`pnpm --filter @llang-gap/web build`, then
`pnpm --filter @llang-gap/web start`), not a static export. The next-intl proxy
redirects unprefixed URLs using the saved `NEXT_LOCALE` cookie, then the browser's
`Accept-Language`, with English as the fallback. Explicit `/en/` and `/ru/` URLs
take priority; the header language switcher remembers the choice for one year.

The website follows the system's light or dark appearance by default. The theme
button in the header switches between light and dark and remembers the choice in
this browser across reloads and both languages.

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

## Contributing

Logo files, light/dark variants, avatars and favicons are available in the
[logo package](brand/README.md), with SVG and PNG exports and placement guidance.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, scope, verification, and PR
expectations. Report bugs or discuss feature and methodology proposals through
the [issue forms](https://github.com/limit-115/llang-gap/issues/new/choose).

## Live experiments

Read [the operator guide](docs/runner.md) and [the exact protocol](docs/protocol.md)
before running paid evaluations. The [primary comparison plan](docs/first-comparison.md)
uses author prompts/extraction with the 2048-token API cap (`author-api-v3`);
experimental v2 is historical only. Pricing, model availability and the output cap
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

## Import conventions

Use relative imports only for sibling files (`./columns`, `./styles.css`). Imports
from parents or child directories use aliases instead, including type imports,
re-exports, and literal dynamic imports. Oxlint enforces this in `pnpm lint`.

- Web source: `@/features/releases/data` (`apps/web/src`).
- Runner and library internals: `#src/module` (each package's `src`, using native
  `package.json` subpath imports mapped to TypeScript files).
- Between workspace packages: public `@llang-gap/contracts`-style exports.
- Shared test helpers and data: `@tests/fixtures`, `@tests/fixtures/questions.json`.
- Web release data: `@results/index.json`.
- Providers' own package metadata: `#package.json`.

TypeScript paths are resolved relative to the config that declares them, without
`baseUrl`. Next.js and tsx support these paths; Vitest uses Vite's built-in
`resolve.tsconfigPaths`, so no alias plugin or duplicate test mapping is needed.
When adding paths in a child tsconfig, remember that `paths` replaces the inherited
map rather than merging it. Keep aliases scoped to the owning app or package;
do not reach into another workspace package's private source files.
