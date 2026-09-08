# Benchmark protocol

Dataset, benchmark languages and model conditions are experiment inputs; UI locales are unrelated.
Independent language scores may use unequal question sets. A single-language run needs no comparison.
Changes to prompts, parsing or scientific conditions need a new protocol identity, not rewritten results.
Never put target answers or solutions in prompts, repair pinned data in place, or select questions by outcome.

## Accuracy and post-run comparisons

Accuracy averages correctness over questions and prespecified repeats, without voting or best-of selection.
Wrong, refused and unparseable completed answers remain outcomes; never selectively retry them.
Comparisons require compatible pinned datasets, protocol, token policy, repeats and aligned question sets.
Do not silently intersect incomplete sets. See [comparison validation](../apps/runner/src/compare.ts).
`gapPp = 100 × (baseline accuracy − candidate accuracy)`; positive values favor the named baseline.
Report both accuracies and the subtraction order. Repeats are not independent questions.
The paired bootstrap resamples question IDs with all repeats and both conditions together (10,000 samples).
Its 95% percentile interval describes question-set variability, not translation quality or model/API drift.
An interval containing zero does not establish direction. Post-hoc pairwise intervals are exploratory,
unadjusted for multiple comparisons; they are not preregistered confirmatory evidence.

## Multiple-choice v1

`multiple-choice-v1` is zero-shot with pinned localized labels; only one uppercase in-range letter parses.
These are Llang Gap conditions, not a claim to reproduce a dataset author's scores or prompt translations.
See [mmPISA](datasets/mmpisa.md) and [MMLU-ProX](protocols/mmluprox.md) for source-specific limitations.

## Identity and publication

Resume uses saved inputs and the recorded source/dependencies, never edited YAML.
Old protocols and artifacts keep their original meaning; do not rescore or relabel them with a new parser.
Truncated output is scored under its recorded protocol but blocks publication of the complete release.
This is project publication policy, not an author scoring rule; do not drop items to pass it.
