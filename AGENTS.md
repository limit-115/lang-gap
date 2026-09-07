# Working on Llang Gap

Read [CONTRIBUTING.md](CONTRIBUTING.md) for scope, verification, documentation, and
PR expectations. More specific instructions apply within their directories;
website work also follows [apps/web/AGENTS.md](apps/web/AGENTS.md).

## Contribution and pull request requirements

- Follow [CONTRIBUTING.md](CONTRIBUTING.md) for every change; read it before
  starting implementation.
- When creating or updating a PR, use [.github/pull_request_template.md](.github/pull_request_template.md),
  including when supplying the body through `gh` or an API.
- For UI changes, including cosmetic changes, attach before/after screenshots in
  the PR's **UI changes** section. Check and capture EN only, unless the change
  specifically concerns another language; then also check and capture that language.
  Add a short recording when motion or interaction needs it. Screenshots are required;
  a preview link or a claim of visual inspection is not a substitute.
- Follow [the screenshot upload guide](docs/pr-screenshots.md) to upload images
  through `gh api` and embed them in the PR. Browser login is not required for
  this method. Read back the PR and confirm the images render before finishing.

## Working defaults

- Unless explicitly instructed otherwise, do all work in a separate Git worktree
  on a new branch based on freshly fetched `origin/main`, and submit changes through
  a PR targeting `main`.
- Use the pinned Node and pnpm versions. Inspect the relevant package scripts and
  existing patterns before changing code; do not introduce another package manager.
- Keep changes focused and preserve other contributors' work. Keep temporary
  research, implementation plans, and review screenshots outside the repository.
- Validate changed behavior with focused tests and the relevant checks in
  [CONTRIBUTING.md](CONTRIBUTING.md#verification). Report what ran, what passed,
  and what remains unverified. Documentation-only changes need formatting, link,
  and applicable template validation, not a full application build.
- Update documentation for changed user workflows or durable constraints. Avoid
  duplicating types, obvious control flow, or PR summaries in internal docs.

## Benchmark identity — architectural invariant

Llang Gap is a **multilingual benchmark across datasets**, selected at run time.
A dataset ID and one or more benchmark language tags are experiment inputs, not
application constants. The website's UI locales do not define benchmark languages.
Never introduce fixed language tuples, language-specific score fields, a default
comparison pair, a universal dataset, or a universal question count. Dataset and
protocol adapters declare their supported inputs; historical pinned conditions
remain local to their versioned adapter/configuration. Test cross-package changes
with non-default languages, multiple dataset identities, and single-language runs.

## Project constraints

- Keep shared schemas and types in `packages/contracts`. The website reads
  published aggregates; runner state and provider execution stay outside it.
- Preserve pinned dataset/prompt inputs and explain methodology changes against
  [docs/protocol.md](docs/protocol.md). Never place target answers in prompts.
- Use synthetic fixtures and fake/intercepted providers for verification. Do not
  launch paid evaluations as a routine check. `--offline` does not block model APIs;
  explicit paid work follows [docs/runner.md](docs/runner.md) with an agreed budget.
- Preserve local run state and immutable releases. Follow
  [docs/releases.md](docs/releases.md) when correcting or staging results.
- Keep credentials and private run artifacts out of commits and public evidence.
- Keep messages consistent across supported UI locales and display identical numerical results.
  UI locale support is independent of dataset and experiment language selection.

Contribution-workflow guidance is adapted from T3 Code; see
[source attribution](.github/ATTRIBUTION.md).
