# Working on Llang Gap

Read [CONTRIBUTING.md](CONTRIBUTING.md) for scope, verification, documentation, and
PR expectations. More specific instructions apply within their directories;
website work also follows [apps/web/AGENTS.md](apps/web/AGENTS.md).

## Working defaults

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
- Keep EN/RU messages consistent and display identical numerical results in both locales.

Contribution-workflow guidance is adapted from T3 Code; see
[source attribution](.github/ATTRIBUTION.md).
