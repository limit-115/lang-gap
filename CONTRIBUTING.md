# Contributing to Llang Gap

Llang Gap is a multilingual benchmark across datasets and prompt languages.
Dataset IDs and benchmark language tags are run inputs; website locales are independent. Contributions should make
the benchmark easier to reproduce, audit, or use. Bug reports, focused fixes,
documentation improvements, and UI translation corrections are welcome.

## Before starting

Search existing [issues](https://github.com/limit-115/llang-gap/issues) and
[pull requests](https://github.com/limit-115/llang-gap/pulls) first. Use the
[bug report form](https://github.com/limit-115/llang-gap/issues/new?template=bug_report.yml)
for broken behavior and the
[feature proposal form](https://github.com/limit-115/llang-gap/issues/new?template=feature_request.yml)
for new capabilities or methodology changes.

Small fixes can go straight to a PR. For a new provider, dataset, language,
protocol change, substantial dependency, or architectural rewrite, agree on the
scope in an issue before investing in the implementation. An existing maintainer
request or agreed issue is enough; no second approval is needed to start.

Keep one concern per PR. Separate unrelated fixes, formatting sweeps, and
refactors. Opening a proposal or PR does not guarantee acceptance; maintainers may
ask for a smaller change or defer work outside the current scope. Keep feedback
specific and respectful.

## Development setup

Fork or clone the repository and create a branch from `main`. Use the Node version
in [.node-version](.node-version) and the pnpm version pinned by `packageManager`
in [package.json](package.json).

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The website, unit tests, and builds do not need model API keys. See the
[README](README.md#quick-start) for the free fake-provider smoke test and
[repository layout](README.md#layout). Read [AGENTS.md](AGENTS.md) and any
directory-specific instructions when using a coding agent.

## Implementation and documentation

- Follow the existing TypeScript patterns, strict shared contracts, and
  oxfmt/oxlint configuration. Prefer a small change over a new abstraction or dependency.
- Add focused regression coverage for changed behavior. Test observable outcomes;
  avoid tests that merely repeat implementation details. Documentation and cosmetic
  changes do not need new unit tests.
- Use synthetic fixtures and intercepted provider transports in tests. Tests must
  not require credentials or make live model requests.
- Keep supported UI locale messages in sync in the feature that owns them.
  Check EN only, unless the change specifically concerns another language; then
  also check that language.
- Update user/operator instructions when a command or workflow changes. Internal
  documentation should explain decisions, cross-package constraints, and pitfalls
  that are hard to discover in code. Put local implementation reasoning in nearby
  comments. Rewrite outdated guidance instead of appending a second account.
- Keep temporary plans, debug output, and PR-only screenshots out of Git. Attach
  review evidence directly to the PR.

AI-assisted contributions follow the same standards: review the diff, understand
the change, verify it, and accurately report what you checked.

## Benchmark integrity

Read the [protocol](docs/protocol.md) before changing datasets, prompt construction,
answer parsing, scoring, or statistics. Explain the effect on comparability and
update the protocol documentation and versioned inputs when the methodology changes.
Preserve pinned revisions, hashes, and upstream attribution. Keep target answers
out of model prompts. Preserve every selected language condition. Compute paired statistics
only for explicitly configured comparisons with validated question alignment; never
assume a fixed language pair or pool scores across datasets.

Use the fake provider for routine development. `--offline` only disables dataset
downloads; it does not disable live provider APIs. Paid evaluations require an
explicit operator request and budget; follow the [operator guide](docs/runner.md).

Follow the [release guide](docs/releases.md) for result changes. Never pass synthetic
or partial runs off as benchmark results or overwrite an existing release. Corrections
need a new release ID and an explanation. Keep API keys, `.env` files, local SQLite
journals, raw SDK responses, and large response/dataset exports out of commits and
issue attachments. Share only the relevant, redacted evidence.

The website consumes verified published aggregates. It must not run evaluations
or read the private run database, and both locales must display the same scores.

## Verification

Run `pnpm format:check` for every PR, then the checks relevant to the change:

| Change                                            | Checks                                                                                                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation or GitHub templates only            | Review links and rendered text; validate any YAML forms                                                                                                                           |
| Runner, datasets, evaluation, or providers        | `pnpm lint:core`, `pnpm typecheck:core`, `pnpm test:core`, `pnpm schema:check`                                                                                                    |
| Website                                           | `pnpm lint`, `pnpm --filter @llang-gap/web typecheck`, `pnpm --filter @llang-gap/web build`, and a browser check in EN (also the affected language for language-specific changes) |
| Shared contracts or workspace/build configuration | Both core and website checks                                                                                                                                                      |

During development, use `pnpm exec vitest run <test-file>` for focused tests.
`pnpm check` runs format, lint, typecheck, tests, and build across the monorepo;
`pnpm schema:check` is separate. If the experiment schema changes, regenerate it
with `pnpm schema` and commit `experiments/schema.json` with the source change.

Describe the commands you ran and their outcomes in the PR. State any skipped,
failing, or unavailable checks and why. Fix failures caused by the change; the
existing [CI workflow](.github/workflows/ci.yml) must pass before merge.

## Opening a pull request

Target `main` and use the [PR template](.github/pull_request_template.md). A draft
is useful while work or verification is incomplete.

- Use a concise conventional title, such as `fix(runner): preserve retry budget`
  or `docs: clarify release verification`.
- Describe the problem, what changed, and why. Link the related issue when there
  is one; an issue is not required for a small fix.
- Include clear before/after screenshots in EN only for visible UI changes. If the
  change specifically concerns another language, also capture that language. Add a
  short recording when motion, timing, or interaction is needed to understand the result.
- Explain benchmark/protocol or public artifact impact when relevant. Include
  verification results and any compatibility or migration considerations.

## Attribution

These guidelines and the repository templates adapt the contribution practices of
[T3 Code](https://github.com/pingdotgg/t3code). See the pinned sources and retained
MIT notice in [.github/ATTRIBUTION.md](.github/ATTRIBUTION.md). Project contributions
use the repository's [MIT license](LICENSE); retain notices for third-party material.
