# Multilingual benchmark protocol

Llang Gap evaluates multiple datasets and languages. Every experiment selects one
versioned dataset, one or more language tags, a protocol, model/effort conditions,
repeats and seed. Website UI locales have no influence on any of these inputs.

## Dataset and protocol boundaries

Dataset manifests declare source files, revision, hashes, language/split row
counts and normalization. The loader resolves the selected dataset ID and reads
only selected languages. It rejects missing languages, corrupt files, duplicate
question identities and mismatched source metadata before execution. See
[dataset manifests](datasets.md) for the supported input formats.

Protocol adapters own prompt construction, supported dataset/language conditions,
answer extraction, stops and any fixed token cap. Unsupported combinations fail
before a model request; there is no language fallback or automatic translation.
The runner schedules the resolved conditions without knowing a language pair or
dataset-specific row count. Transports execute requests without interpreting the
benchmark language or selecting a scoring rule.

## Multiple-choice v1

`multiple-choice-v1` is a separate, zero-shot multiple-choice condition. Each
selected language requires pinned `instruction`, `question` and `options` labels
in a schema-v2 dataset manifest. The localized instruction must request exactly
one uppercase option letter. The prompt consists of instruction, a blank line,
question label and target text, a blank line, options label and A–J-labelled
options, followed by a newline. No demonstration, target answer or solution is
included. The target is projected to `PromptQuestion` without `answer` or `cot`.

Extraction trims surrounding whitespace and accepts exactly one uppercase A–J
letter within the available option count. Everything else is unparseable and
scores zero. Every visible response follows this rule, including refusal-tagged
and cap-limited output; truncation still blocks publication. Effort and output
cap are explicit experiment settings. This is a new protocol, not a relabelling
of any existing author's results.

## Versioned dataset-specific protocols

The [MMLU-ProX adapter](protocols/mmluprox.md) preserves its pinned source files,
prompt bytes, v1/v3 protocol-object hashes, parser rules and author token cap.
Its currently vendored language coverage belongs to that adapter. Extending that
coverage requires pinned and reviewed localized source inputs plus a new protocol
version; accepting an arbitrary language tag never implies those sources exist.

## Accuracy and explicit comparisons

Each selected language has its own test-question count, accuracy and per-repeat
accuracies. Questions have equal weight; repeat correctness is averaged without
majority voting or best-of selection. Independent languages may have different
question sets. A single-language experiment produces scores and no gap.

`comparisons` explicitly lists `{ baseline, language }` conditions within the same
dataset. Each pair must have identical test IDs, categories, gold labels and option
counts. Missing questions fail validation; no intersection, exclusion or silent
pairing is allowed. Datasets are never pooled into an aggregate or language gap.

`gapPp = 100 × (accuracy_baseline − accuracy_language)`

For each comparison and model/effort, 10,000 deterministic paired bootstrap
samples resample unique question IDs, retaining both languages and all repeats
in each cluster. The 2.5th/97.5th percentiles use linear interpolation. Repeats
are not independent questions. Positive gaps favour the explicitly named baseline;
an interval containing zero does not establish the direction of the difference.
Input result ordering cannot change the estimate. Report both language scores,
question counts, repeats and explicit subtraction order with every gap.

## Identity, execution and publication

Changing dataset, languages, comparisons, protocol, localized inputs or scientific
settings creates a new run identity. Schema-v3 snapshots contain the complete
resolved experiment, selected dataset snapshot, original manifest, protocol object
and implementation fingerprint. Resume uses that snapshot, never edited YAML or
new selection flags. Completion, cost accounting, retry and release gates apply
to every selected condition. See [runner](runner.md) and [releases](releases.md).

Historical schema-v1/v2 runs and releases remain immutable and require their
recorded checkout and dependencies. New aggregate shapes must not be written over
them. For a fresh run, update the experiment schema and explicitly choose its
comparisons. The old protocol IDs keep their scientific meaning.

## Scope and uncertainty

Implemented adapters currently score multiple-choice tasks; adding another task
format requires a reviewed adapter and shared contracts. Language selection alone
does not establish semantic translation quality, model access or dataset licensing.
Question-set intervals do not capture training contamination, translation errors,
provider drift or all API sampling uncertainty. Routine verification uses only
synthetic fixtures and intercepted providers, without paid evaluations.
