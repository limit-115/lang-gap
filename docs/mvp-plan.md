# Benchmark architecture

Llang Gap is a multilingual benchmark across datasets. Dataset and language
selection belongs to each experiment, independently of website UI locales. The
initial MMLU-ProX comparison is an example configuration, not the domain model.

The original MVP planning narrative described that initial comparison. Use these
maintained specifications for current implementation decisions:

- [Shared benchmark protocol](protocol.md): dataset/protocol boundaries, independent
  language scores, explicit aligned comparisons, statistical units and identity.
- [Dataset manifests](datasets.md): pinned files, format adapters and localized inputs.
- [Runner](runner.md): launch parameters, execution, immutable resume and paid budgets.
- [Release contract](releases.md): versioned aggregates, verification and website boundary.
- [Initial comparison](first-comparison.md) and [MMLU-ProX adapter](protocols/mmluprox.md):
  experiment-specific sources and methodological constraints.
- [Search discovery](search-discovery.md): public release metadata and indexing.

Shared schemas and types live in `packages/contracts`; dataset adapters normalize
inputs; protocol adapters construct prompts and score outputs; transports call
providers; the runner orchestrates the selected experiment. The website reads only
published aggregate contracts. It never imports runner state or scientific execution.

Keep languages as values in records, never language-named fields or a fixed tuple.
A new dataset with the supported normalized multiple-choice format needs a pinned
manifest and localized instructions, not a change to runner scheduling or UI columns.
A new task format or scientific protocol requires reviewed implementation and tests.

Regression coverage must include multiple dataset identities, at least three
non-default language tags, a single-language experiment, unequal independent
question sets, explicit comparison direction, and rejection of missing aligned
conditions. Preserve all selected outcomes and never pool unrelated datasets.
