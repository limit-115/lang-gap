<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/svg/llang-gap-logo-white.svg">
    <img src="brand/svg/llang-gap-logo-black.svg" alt="Llang Gap" width="320">
  </picture>
</h1>

**See how LLM accuracy changes across languages. With open results you can check.**

Llang Gap is an open multilingual benchmark across datasets and prompt languages.
Choose a dataset and one or more languages at launch. Evaluate each language
independently, or explicitly compare aligned questions with a paired uncertainty
interval. Inspect prompts and responses or independently recompute a release.
There is no built-in benchmark language pair; website locales are separate.

Use the results to identify models for further testing on your own tasks. Each
experiment records its languages, dataset, model settings and scope, so you can
judge whether the comparison is relevant to your use case.

Read [how the comparison works](docs/protocol.md) and
[how to check a published release](docs/releases.md).

## Quick start

Requires Node **24 LTS** and pnpm **12.3.4**. The workspace pins both; a frozen lockfile
is used in CI. Node's built-in SQLite keeps the runner self-contained.

```sh
corepack enable
pnpm install --frozen-lockfile

# Download and verify only the languages selected by this example experiment.
pnpm bench dataset prepare experiments/smoke.yaml
pnpm bench plan experiments/smoke.yaml --offline

# Select one language from the example dataset; no implicit comparison.
pnpm bench plan experiments/smoke.yaml --dataset mmlu-prox-lite --language ru --offline
# Select languages and an explicit subtraction order.
pnpm bench plan experiments/smoke.yaml --dataset mmlu-prox-lite --languages ru en --compare ru:en --offline

# Free smoke test with no YAML, prices, budget, or preceding plan required.
pnpm bench run --dataset mmlu-prox-lite --languages ru,en \
  --protocol mmluprox-lite-5shot-author-api-v3 --transport fake \
  --models fake-one,fake-two --efforts low,medium,high,xhigh,max \
  --question-limit 2 --repeats 2 --max-jobs 5 --offline
pnpm bench resume <run-id>
# Copy runId from the JSON output into the commands below.
pnpm bench status <run-id>
pnpm bench score <run-id>
pnpm bench release build <run-id> --id smoke-author-v3 --test
pnpm bench release verify .llang-gap/releases/smoke-author-v3
```

`--offline` disables **dataset downloads**. It does not disable live model APIs.
The fake provider never uses the network. CLI results go to stdout as JSON; progress
and errors go to stderr. Add `--json` for structured errors too.

All experiment settings can be supplied as CLI flags; YAML is optional and flags
take precedence. Lists accept commas or spaces. Rates and a budget are optional;
unknown costs remain `null`. See the [complete flag reference](docs/runner.md#cli-and-yaml-configuration).

Dataset and language overrides are available on `dataset prepare`, `plan` and
`run`. `--languages` (or singular `--language`) replaces the YAML language list
and clears its comparisons; use `--compare baseline:language ...` to request gaps.
`--protocol` selects a reviewed protocol compatible with that dataset/language set.
See [adding a dataset](docs/datasets.md) for normalized JSONL and localized inputs.

## Layout

| Location              | Responsibility                                                              |
| --------------------- | --------------------------------------------------------------------------- |
| `apps/runner`         | Commander CLI, execution, retries, budget ledger, SQLite, release export    |
| `apps/web`            | Next.js site and feature-owned next-intl dictionaries; developed separately |
| `packages/contracts`  | Strict Zod schemas and shared types                                         |
| `packages/datasets`   | Manifest-driven download, format adapters and explicit alignment checks     |
| `packages/evaluation` | Versioned protocol adapters, scoring and explicit paired bootstrap          |
| `packages/providers`  | Official SDK adapters, optional cost accounting and a fake provider         |
| `experiments`         | Strict YAML definitions and generated editor JSON Schema                    |
| `datasets`            | Versioned dataset manifests; data files stay out of Git                     |
| `results`             | Public release index and small manifests/aggregates                         |
| `.llang-gap`          | Ignored local cache, durable run state and release artifacts                |

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

The model shortcut beside the homepage introduction searches by model or provider.
Selecting a model enables **See the conclusion**, a link to
`/[locale]/models/[transport]/[model]`. Those detail pages are reserved for future
implementation.

The leaderboard’s **Languages** menu shows or hides individual language accuracy
columns. Model, effort, gap and the 95% interval always remain visible; hiding a
language does not change the gap calculation. All languages declared by the selected
release are shown by default. Gaps appear only for its explicit comparisons.
A release covers one dataset and protocol; unrelated datasets are never pooled.

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

The checked-in initial configuration selects two available language versions of
**MMLU-ProX Lite**: 588 test questions per language, 5-shot CoT prompts with five
worked examples per subject, and GPT-6 Astra and Claude Fable 5.1 at low, medium and high native reasoning
effort. It measures academic multiple-choice accuracy.

Read [the operator guide](docs/runner.md) and [its exact protocol](docs/protocols/mmluprox.md)
before running paid evaluations. These are example conditions, not benchmark-wide defaults. The [primary comparison plan](docs/first-comparison.md)
uses author prompts/extraction with the 2048-token API cap (`author-api-v3`);
experimental v2 is historical only. Pricing, model availability and the output cap
must be checked for your API account. The configured USD rates are dated
2026-09-06 and apply to standard, short-context API requests.

Set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENROUTER_API_KEY` in the process
environment for the selected transport. See [OpenRouter runs](docs/runner.md#openrouter)
for transport/model configuration and a technical pilot. Local `.env`
files are ignored by Git but are **not automatically loaded** by the CLI. Do not put
keys in experiment YAML or public artifacts.

```sh
pnpm bench plan experiments/pilot.yaml
# Explicit paid pilot: 24 requests across all six model/effort configurations.
pnpm bench run experiments/pilot.yaml --budget-usd 30

# Inspect usage/truncation, freeze the protocol, then commit the source/configuration.
pnpm bench plan experiments/mvp.yaml --offline
# Optional budget chosen from pilot evidence.
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

See [search and AI discovery](docs/search-discovery.md) for the public origin,
preview indexing rules, and the publication checklist for citable release pages.

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
