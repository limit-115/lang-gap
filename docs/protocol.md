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
in a schema-v2/v3 dataset manifest. The localized instruction must request exactly
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

The [mmPISA conditions](datasets/mmpisa.md) use this protocol with separately
pinned human and machine translation datasets. Context precedes the question;
composite answer choices remain ordered arrays within one option. Their localized
labels are Llang Gap inputs, not upstream author prompts. No author-baseline
equivalence is implied, and translation variants are never pooled.

## Versioned dataset-specific protocols

The [MMLU-ProX adapter](protocols/mmluprox.md) preserves its pinned source files,
prompt bytes, v1/v3 protocol-object hashes, parser rules and author token cap.
Its currently vendored language coverage belongs to that adapter. Extending that
coverage requires pinned and reviewed localized source inputs plus a new protocol
version; accepting an arbitrary language tag never implies those sources exist.

## Explicitly omitted token caps

An experiment can record a numeric `maxOutputTokens` or explicit `null`, meaning
that no cap is sent to the provider. This is distinct from infinite output: serving
endpoints retain their own defaults and limits. Token policy remains part of run
and comparison identity. The general multiple-choice adapter supports this mode.

`mmluprox-lite-5shot-flexible-api-v1` is a separate condition that reuses the pinned
author-v3 five-shot prompts, first-match extraction and local task stops while
allowing an experiment-selected numeric or null cap. Its protocol object and hash
are distinct. Author v3 retains exactly 2048 tokens and its original hash;
historical v1 remains numeric. Existing snapshots are never rewritten. These
conditions cannot be pooled or treated as the same author baseline. Publication
still requires the complete dataset and all existing verification gates.

## Accuracy and post-run comparisons

Each selected language has its own test-question count, accuracy and per-repeat
accuracies. Questions have equal weight; repeat correctness is averaged without
majority voting or best-of selection. Independent languages may have different
question sets. A single-language experiment produces scores and no gap.

Comparisons can be selected after execution. `score --compare baseline:language`
and `release build --compare baseline:language` select language pairs within the
saved run. YAML `comparisons` remains an optional preset, defaulting to `[]`.
Analysis settings are separate from the immutable run snapshot; changing a
post-run comparison does not require executing model requests again.

`compare <run-id...>` compares model/effort/language conditions within or across
completed runs. Filters select saved models, efforts, transports and languages.
It enumerates each unordered pair once and records its explicit baseline and
candidate, retaining every condition's scores. Compatible pairs require the same
dataset ID and full pinned manifest, protocol hash, token cap, repeat count and
aligned selected test IDs, categories, gold labels and option counts. Same-language
comparisons also require identical prompt bytes. When snapshot hashes differ,
all saved rows for every language present in both runs must match, including
question and option text outside the selected analysis pair. Synthetic and live conditions
are separate. Different efforts may be compared; their labels do not imply equal
compute. Different dataset snapshots caused solely by selecting different
languages can be compatible when these checks pass.
Disjoint language selections rely on the pinned manifest and recorded implementation
identity; their translated text cannot be checked against one another.

No intersection, dropped questions or pooling across datasets is allowed. The
comparison report lists incompatible pairs and reasons instead of inventing a gap.
A requested filter that matches no condition fails. Incomplete runs must be resumed
before analysis. Completed truncated responses can be scored and analyzed with
their recorded parser; truncation continues to block release publication.

`gapPp = 100 × (accuracy_baseline − accuracy_language)`

For each comparison, 10,000 deterministic paired bootstrap samples resample unique
question IDs, retaining both conditions and all repeats in each cluster. The 2.5th/97.5th percentiles use linear interpolation. Repeats
are not independent questions. Positive gaps favour the explicitly named baseline;
an interval containing zero does not establish the direction of the difference.
Input result ordering cannot change the estimate. General comparison reports use
`gapPp = 100 × (accuracy_baseline − accuracy_candidate)` and name both conditions
by run, transport, model, effort and language. Report both scores, question counts,
repeats and explicit subtraction order with every gap. These are exploratory,
unadjusted pairwise intervals; selecting many comparisons after seeing results is
not a preregistered confirmatory test or a multiple-comparison correction.

## Identity, execution and publication

Changing execution inputs (dataset, languages, protocol, localized prompts, model
conditions, repeats or question selection) creates a new run identity. Optional
legacy comparisons in YAML remain part of that snapshot, while post-run analysis
choices are saved separately. Schema-v3 snapshots contain the complete
resolved experiment, selected dataset snapshot, original manifest, protocol object
and implementation fingerprint. Resume uses that snapshot, never edited YAML or
new selection flags. Completion, cost accounting, retry and release gates apply
to every selected condition. See [runner](runner.md) and [releases](releases.md).

Historical schema-v1/v2 runs and releases remain immutable and require their
recorded checkout and dependencies. New aggregate shapes must not be written over
them. For a fresh run, update the experiment schema and choose its scientific inputs. The old protocol IDs keep their scientific meaning.

## Scope and uncertainty

Implemented adapters currently score multiple-choice tasks; adding another task
format requires a reviewed adapter and shared contracts. Language selection alone
does not establish semantic translation quality, model access or dataset licensing.
Question-set intervals do not capture training contamination, translation errors,
provider drift or all API sampling uncertainty. Routine verification uses only
synthetic fixtures and intercepted providers, without paid evaluations.
