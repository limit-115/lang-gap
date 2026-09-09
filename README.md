<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/svg/lang-gap-logo-white.svg">
    <img src="brand/svg/lang-gap-logo-black.svg" alt="Lang Gap" width="320">
  </picture>
</h1>

**See how LLM accuracy changes across languages. With open results you can check.**

Lang Gap is an open multilingual benchmark across datasets and prompt languages.
Choose a dataset and one or more languages at launch. Evaluate each language
independently, then compare compatible saved models and languages on aligned
questions with a paired uncertainty interval. Inspect prompts and responses or independently recompute a release.
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

# Free smoke test with no YAML, prices, or preceding plan required.
pnpm bench run --dataset mmlu-prox-lite --languages ru,en \
  --protocol mmluprox-lite-5shot-author-api-v3 --max-output-tokens 2048 --transport fake \
  --models fake-one,fake-two --efforts low,medium,high,xhigh,max \
  --question-limit 2 --repeats 2 --max-jobs 5 --offline
pnpm bench resume <run-id>
# Copy runId from the JSON output into the commands below.
pnpm bench status <run-id>
pnpm bench score <run-id> --compare ru:en
pnpm bench compare <run-id> --models fake-one,fake-two --efforts max --languages ru,en
pnpm bench release build <run-id> --id smoke-author-v3 --test --compare ru:en
pnpm bench release verify .llang-gap/releases/smoke-author-v3
```

`--offline` disables **dataset downloads**. It does not disable live model APIs.
The fake transport never uses the network. CLI results go to stdout as JSON; progress
and errors go to stderr. Add `--json` for structured errors too.

All experiment settings can be supplied as CLI flags; YAML is optional and flags
take precedence. Lists accept commas or spaces. Token rates for recorded usage are optional;
unknown costs remain `null`. See the [runner setup guide](docs/runner.md#cli-and-yaml-configuration).

Use **Build a run** in the website navigation, or **Missing a model?** on the
homepage, to configure a local experiment. On screens narrower than 768px, this
page explains the workflow and offers a link to copy and open on a computer;
the builder is available on wider screens. Select a dataset, compatible protocol,
one or more benchmark languages, transport and model IDs. The builder generates
copyable bash/zsh commands for `run` and the API-free `plan`, with request counts,
advanced execution settings and first-time setup instructions. It never starts a
run or asks for credentials. Model availability and native effort support remain
model- and API-specific; use YAML for mixed transports or per-model settings.

Dataset and language overrides are available on `dataset prepare`, `plan` and
`run`. `--languages` (or singular `--language`) replaces the YAML language list
and clears its comparisons; use `--compare baseline:language ...` to request gaps.
`--protocol` selects a reviewed protocol compatible with that dataset/language set.
See [adding a dataset](docs/datasets.md) for normalized JSONL and localized inputs.

[mmPISA](docs/datasets/mmpisa.md) is available as `mmpisa` (human translations) and
`mmpisa-machine` (machine translations), each with 43 languages and 25 test
questions per language. Both use `multiple-choice-v1`. For a free smoke test:

```sh
pnpm bench run experiments/mmpisa-smoke.yaml
```

## Layout

| Location              | Responsibility                                                              |
| --------------------- | --------------------------------------------------------------------------- |
| `apps/runner`         | Commander CLI, execution, retries, attempt journal, SQLite, release export  |
| `apps/web`            | Next.js site and feature-owned next-intl dictionaries; developed separately |
| `packages/contracts`  | Strict Zod schemas and shared types                                         |
| `packages/datasets`   | Manifest-driven download, format adapters and explicit alignment checks     |
| `packages/evaluation` | Versioned protocol adapters, scoring and explicit paired bootstrap          |
| `packages/transports` | Official SDK adapters, optional cost accounting and a fake transport        |
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

The homepage summarizes all published benchmark results. Each model/API/effort row
shows mean accuracy for each selected language, with an equal weight per available
dataset. A dash means no published result
for that row and language. The searchable **Languages** menu controls visible columns.

The **Which language matters to you?** shortcut below the model finder searches
published benchmark languages by name or tag. It navigates to
`/{locale}/languages/{tag}/`; language detail pages are not implemented yet, so
these reserved destinations currently return 404.

For each dataset and language, the newest run supplies the result; extra runs,
questions and repeats do not increase its weight. Token caps, repeat counts, protocol
versions and dataset revisions remain in the source experiments, not admission
filters. New datasets and languages enter automatically when releases are staged.

Click a model or score to inspect the contributing results and full experiment
history. English is an optional display reference; differences are shown only for
matching dataset sets and aligned inputs. These descriptive differences have no
inferred confidence interval. Original per-dataset paired gaps remain on release pages.

See [summary methodology and operator workflow](docs/model-guide.md) for selection,
coverage and reproducibility. Historical normalized snapshots remain unchanged.

```sh
# release stage synchronizes automatically; this also repairs an interrupted sync:
pnpm bench guide sync
pnpm guide:check
```

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

In the local development server, `/en/releases/` opens the Report Board concept. Use `?design=journal`, `?design=desktop`, or `?design=board` to open one
directly, and `?design=original` to compare the existing page. The concepts group
published releases by UTC day and use the existing site theme. Production builds
keep the original archive while the local archive design is being reviewed.

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
before running paid evaluations. These are example conditions, not benchmark-wide defaults. The [initial experiment](experiments/mvp.yaml)
uses author prompts/extraction with the 2048-token API cap (`author-api-v3`);
experimental v2 is historical only. Pricing, model availability and the output cap
must be checked for your API account. The configured USD rates are dated
2026-09-06 and apply to standard, short-context API requests.

Set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENROUTER_API_KEY` in the repository
root `.env` file or the process environment for the selected transport. The CLI
automatically loads that `.env` file for every command, preserves existing process
environment values, and runs normally if the file is absent. See
[OpenRouter runs](docs/runner.md#openrouter) for transport/model configuration and a
technical pilot. Local `.env` files are ignored by Git. Do not put keys in
experiment YAML or public artifacts.

```sh
pnpm bench plan experiments/pilot.yaml
# Explicit paid pilot: 24 requests across all six model/effort configurations.
pnpm bench run experiments/pilot.yaml

# Inspect usage/truncation, freeze the protocol, then commit the source/configuration.
pnpm bench plan experiments/mvp.yaml --offline
pnpm bench run experiments/mvp.yaml
```

Full MVP: **588 test questions × 2 languages × 6 configurations × 3 repeats =
21,168 requests**, before retries. `plan` validates the selected conditions and
reports their request counts.

Public releases must come from full, complete runs that started from a clean Git
commit. A model refusal or unparseable completed answer scores zero. Technical
missing responses and token truncation block release. Existing releases are never
overwritten; corrected results receive a new release ID.

## Open artifacts

See [search and AI discovery](docs/search-discovery.md) for the public origin,
preview indexing precautions, and checks for citable release pages.

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
- Transport adapters' own package metadata: `#package.json`.

TypeScript paths are resolved relative to the config that declares them, without
`baseUrl`. Next.js and tsx support these paths; Vitest uses Vite's built-in
`resolve.tsconfigPaths`, so no alias plugin or duplicate test mapping is needed.
When adding paths in a child tsconfig, remember that `paths` replaces the inherited
map rather than merging it. Keep aliases scoped to the owning app or package;
do not reach into another workspace package's private source files.

CLI runs omit the API token cap unless `--max-output-tokens` is supplied (or YAML
sets a cap). Select a compatible protocol. See [output token policy](docs/runner.md#omitting-the-output-token-cap).

## Brand name and compatibility

The public brand is **Lang Gap**. The repository URL, `@llang-gap/*` workspace
packages, `LLANG_*` environment variables, `.llang-gap/` local state, and existing
citation keys retain their identifiers for compatibility. Versioned protocol
provenance and immutable published releases retain their original wording.
